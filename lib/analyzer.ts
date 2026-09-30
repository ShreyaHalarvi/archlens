import type {
  AnalyzedFile,
  Dependency,
  RepositoryFile,
} from "./types";

const LANGUAGE_BY_EXT: Record<string, string> = {
  py: "Python",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  json: "JSON",
};

export function analyzeRepository(
  repositoryFiles: RepositoryFile[]
) {
  const files = repositoryFiles.map(analyzeFile);

  const pathSet = new Set(
    files.map((file) => file.path)
  );

  const dependencies: Dependency[] = [];

  for (const file of files) {
    for (const target of file.internalImports) {
      dependencies.push({
        source: file.path,
        target,
        type: "internal",
      });
    }

    for (const target of file.externalImports) {
      dependencies.push({
        source: file.path,
        target,
        type: "external",
      });
    }
  }

  const uniqueDependencies =
    dedupeDependencies(dependencies);

  const issues = detectArchitectureIssues(
    files,
    uniqueDependencies,
    pathSet
  );

  const languageCounts: Record<string, number> = {};

  for (const file of files) {
    languageCounts[file.language] =
      (languageCounts[file.language] || 0) + 1;
  }

  const layers = [
    ...new Set(files.map((file) => file.layer)),
  ].filter((layer) => layer !== "unknown");

  const entryPoints = files
    .filter((file) => file.isEntryPoint)
    .map((file) => file.path);

  const externalDependencies = [
    ...new Set(
      files.flatMap((file) =>
        file.externalImports.map(normalizePackage)
      )
    ),
  ].filter(Boolean);

  return {
    metrics: {
      fileCount: files.length,
      dependencyCount:
        uniqueDependencies.length,
      internalDependencyCount:
        uniqueDependencies.filter(
          (d) => d.type === "internal"
        ).length,
      externalDependencyCount:
        uniqueDependencies.filter(
          (d) => d.type === "external"
        ).length,
      entryPointCount: entryPoints.length,
      layerCount: layers.length,
    },

    languages: languageCounts,
    layers,
    entryPoints,
    externalDependencies,
    files,
    dependencies: uniqueDependencies,
    issues,
  };
}

/* -------------------------------------------------------------------------- */
/* File Analysis                                                              */
/* -------------------------------------------------------------------------- */

function analyzeFile(
  file: RepositoryFile
): AnalyzedFile {
  const language = detectLanguage(file.path);

  const imports = extractImports(
    file.content,
    language
  );

  const internalImports = imports.filter(
    (item) =>
      looksInternal(
        item,
        file.path,
        language
      )
  );

  const externalImports = imports.filter(
    (item) => !internalImports.includes(item)
  );

  return {
    path: file.path,
    language,
    layer: inferLayer(file.path),
    imports,

    internalImports: internalImports
      .map((item) =>
        resolveInternalImport(
          item,
          file.path,
          language
        )
      )
      .filter(Boolean),

    externalImports,

    isEntryPoint: isEntryPoint(
      file.path,
      file.content,
      language
    ),
  };
}

function detectLanguage(path: string) {
  const ext =
    path.split(".").pop()?.toLowerCase() || "";

  return LANGUAGE_BY_EXT[ext] || "Other";
}

/* -------------------------------------------------------------------------- */
/* Import Extraction                                                          */
/* -------------------------------------------------------------------------- */

function extractImports(
  content: string,
  language: string
) {
  const found = new Set<string>();

  if (language === "Python") {
    /*
     * Handles:
     *
     * import fastapi
     * import fastapi.routing
     * from fastapi import FastAPI
     * from fastapi.routing import APIRouter
     * from .utils import helper
     * from ..dependencies import utils
     */

    for (const match of content.matchAll(
      /^\s*import\s+([A-Za-z0-9_.,\s]+)/gm
    )) {
      const value = match[1];

      for (const part of value.split(",")) {
        const cleaned = part
          .trim()
          .split(/\s+as\s+/)[0]
          .trim();

        if (cleaned) {
          found.add(cleaned);
        }
      }
    }

    for (const match of content.matchAll(
      /^\s*from\s+([.\w]+)\s+import\s+/gm
    )) {
      found.add(match[1]);
    }
  } else if (
    language === "JavaScript" ||
    language === "TypeScript"
  ) {
    const importPattern =
      /(?:(?:import\s+(?:[\s\S]*?\s+from\s+)?|require\s*\(\s*|import\s*\(\s*))["']([^"']+)["']/g;

    for (const match of content.matchAll(
      importPattern
    )) {
      found.add(match[1]);
    }
  }

  return [...found].slice(0, 80);
}

/* -------------------------------------------------------------------------- */
/* Internal Import Detection                                                  */
/* -------------------------------------------------------------------------- */

function looksInternal(
  importPath: string,
  sourcePath: string,
  language: string
) {
  if (
    importPath.startsWith(".") ||
    importPath.startsWith("/")
  ) {
    return true;
  }

  if (language === "Python") {
    /*
     * We cannot know whether every top-level Python
     * package is internal until we inspect the repository.
     *
     * Therefore common local package names are resolved
     * later against the repository file set.
     */
    return looksLikePythonModule(importPath);
  }

  return false;
}

function looksLikePythonModule(
  importPath: string
) {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(
    importPath
  );
}

/* -------------------------------------------------------------------------- */
/* Internal Import Resolution                                                 */
/* -------------------------------------------------------------------------- */

function resolveInternalImport(
  importPath: string,
  sourcePath: string,
  language: string
) {
  if (language === "Python") {
    return resolvePythonImport(
      importPath,
      sourcePath
    );
  }

  return resolveJavaScriptImport(
    importPath,
    sourcePath
  );
}

/* -------------------------------------------------------------------------- */
/* Python Resolution                                                          */
/* -------------------------------------------------------------------------- */

function resolvePythonImport(
  importPath: string,
  sourcePath: string
) {
  const sourceParts = sourcePath.split("/");

  sourceParts.pop();

  let baseParts = sourceParts;

  /*
   * Relative imports:
   *
   * .foo
   * ..foo
   * ...foo
   */

  if (importPath.startsWith(".")) {
    let dots = 0;

    while (
      dots < importPath.length &&
      importPath[dots] === "."
    ) {
      dots++;
    }

    baseParts = sourceParts.slice(
      0,
      Math.max(0, sourceParts.length - (dots - 1))
    );

    const remainder =
      importPath.slice(dots);

    if (remainder) {
      baseParts = [
        ...baseParts,
        ...remainder.split("."),
      ];
    }

    return normalizePath(
      `${baseParts.join("/")}.py`
    );
  }

  /*
   * Absolute Python imports:
   *
   * fastapi.routing
   *
   * becomes:
   *
   * fastapi/routing.py
   *
   * But package __init__.py is also checked by
   * the issue detector through module aliases.
   */

  return (
    importPath.replace(/\./g, "/") +
    ".py"
  );
}

/* -------------------------------------------------------------------------- */
/* JavaScript / TypeScript Resolution                                         */
/* -------------------------------------------------------------------------- */

function resolveJavaScriptImport(
  importPath: string,
  sourcePath: string
) {
  const base = sourcePath
    .split("/")
    .slice(0, -1)
    .join("/");

  const raw = importPath.replace(
    /^@\//,
    ""
  );

  return normalizePath(
    `${base}/${raw}`
  );
}

/* -------------------------------------------------------------------------- */
/* Path Utilities                                                             */
/* -------------------------------------------------------------------------- */

function normalizePath(value: string) {
  const parts: string[] = [];

  for (const part of value.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join("/");
}

function inferLayer(path: string) {
  const p = path.toLowerCase();

  if (
    /(^|\/)(api|routes?|controllers?|endpoints?)(\/|\.|$)/.test(
      p
    )
  ) {
    return "api";
  }

  if (
    /(^|\/)(services?|usecases?|handlers?)(\/|\.|$)/.test(
      p
    )
  ) {
    return "service";
  }

  if (
    /(^|\/)(models?|schemas?|entities?)(\/|\.|$)/.test(
      p
    )
  ) {
    return "model";
  }

  if (
    /(^|\/)(middleware|middlewares)(\/|\.|$)/.test(
      p
    )
  ) {
    return "middleware";
  }

  if (
    /(^|\/)(db|database|data|repositories?|storage)(\/|\.|$)/.test(
      p
    )
  ) {
    return "database";
  }

  if (
    /(^|\/)(utils?|utilities?|helpers?|lib)(\/|\.|$)/.test(
      p
    )
  ) {
    return "utility";
  }

  if (
    /(^|\/)(test|tests|__tests__)(\/|\.|$)/.test(
      p
    )
  ) {
    return "test";
  }

  return "unknown";
}

function isEntryPoint(
  path: string,
  content: string,
  language: string
) {
  const p = path.toLowerCase();

  if (
    /(^|\/)(main|app|server|index)\.(py|js|jsx|ts|tsx|mjs|cjs)$/.test(
      p
    )
  ) {
    return true;
  }

  if (
    /(routes?|controllers?|api|endpoints?)/.test(p)
  ) {
    return true;
  }

  if (
    language === "Python" &&
    /if\s+__name__\s*==\s*["']__main__["']/.test(
      content
    )
  ) {
    return true;
  }

  return false;
}

function normalizePackage(value: string) {
  if (value.startsWith("@")) {
    const parts = value.split("/");

    return parts.length >= 2
      ? `${parts[0]}/${parts[1]}`
      : value;
  }

  return value
    .split("/")[0]
    .split(".")[0];
}

function dedupeDependencies(
  dependencies: Dependency[]
) {
  const seen = new Set<string>();

  return dependencies.filter(
    (dependency) => {
      const key = `${dependency.source}|${dependency.target}|${dependency.type}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Surprise Challenge Detection                                               */
/* -------------------------------------------------------------------------- */

function detectArchitectureIssues(
  files: AnalyzedFile[],
  dependencies: Dependency[],
  pathSet: Set<string>
) {
  const internalDependencies =
    resolveExistingInternalDependencies(
      files,
      dependencies,
      pathSet
    );

  const circularDependencies =
    findCycles(
      internalDependencies,
      pathSet
    );

  const deadFiles =
    findPotentiallyUnusedFiles(
      files,
      internalDependencies,
      pathSet
    );

  return {
    circularDependencies,
    deadFiles,
  };
}

/* -------------------------------------------------------------------------- */
/* Resolve Python Package Aliases                                             */
/* -------------------------------------------------------------------------- */

function resolveExistingInternalDependencies(
  files: AnalyzedFile[],
  dependencies: Dependency[],
  pathSet: Set<string>
) {
  const aliases = buildModuleAliases(
    pathSet
  );

  const resolved: Dependency[] = [];

  for (const dependency of dependencies) {
    if (dependency.type !== "internal") {
      continue;
    }

    if (pathSet.has(dependency.target)) {
      resolved.push(dependency);
      continue;
    }

    const aliasTarget =
      aliases.get(
        dependency.target
      );

    if (aliasTarget) {
      resolved.push({
        ...dependency,
        target: aliasTarget,
      });
    }
  }

  /*
   * Also resolve imports that were initially
   * classified as external-looking Python modules.
   */

  for (const file of files) {
    if (file.language !== "Python") {
      continue;
    }

    for (const importPath of file.imports) {
      const resolvedTarget =
        resolvePythonAgainstRepository(
          importPath,
          file.path,
          pathSet,
          aliases
        );

      if (!resolvedTarget) {
        continue;
      }

      const alreadyExists = resolved.some(
        (dependency) =>
          dependency.source === file.path &&
          dependency.target === resolvedTarget
      );

      if (!alreadyExists) {
        resolved.push({
          source: file.path,
          target: resolvedTarget,
          type: "internal",
        });
      }
    }
  }

  return dedupeDependencies(
    resolved
  );
}

function buildModuleAliases(
  pathSet: Set<string>
) {
  const aliases = new Map<
    string,
    string
  >();

  for (const filePath of pathSet) {
    if (!filePath.endsWith(".py")) {
      continue;
    }

    const withoutExtension =
      filePath.slice(0, -3);

    aliases.set(
      withoutExtension,
      filePath
    );

    /*
     * package/__init__.py can be imported
     * as package.
     */

    if (
      withoutExtension.endsWith(
        "/__init__"
      )
    ) {
      const packageName =
        withoutExtension.slice(
          0,
          -"__init__".length
        );

      const cleanPackage =
        packageName.endsWith("/")
          ? packageName.slice(0, -1)
          : packageName;

      aliases.set(
        cleanPackage,
        filePath
      );
    }

    /*
     * Also expose the module name without
     * its repository-level parent path.
     */

    const parts =
      withoutExtension.split("/");

    if (parts.length > 0) {
      aliases.set(
        parts[parts.length - 1],
        filePath
      );
    }
  }

  return aliases;
}

function resolvePythonAgainstRepository(
  importPath: string,
  sourcePath: string,
  pathSet: Set<string>,
  aliases: Map<string, string>
) {
  if (importPath.startsWith(".")) {
    const direct =
      resolvePythonImport(
        importPath,
        sourcePath
      );

    if (pathSet.has(direct)) {
      return direct;
    }

    const initCandidate =
      direct.replace(
        /\.py$/,
        "/__init__.py"
      );

    if (pathSet.has(initCandidate)) {
      return initCandidate;
    }

    return undefined;
  }

  const direct =
    aliases.get(importPath);

  if (direct) {
    return direct;
  }

  /*
   * Search for repository files whose
   * module path ends with the imported
   * Python module.
   */

  const normalizedImport =
    importPath.replace(/\./g, "/");

  for (const filePath of pathSet) {
    if (!filePath.endsWith(".py")) {
      continue;
    }

    const withoutExtension =
      filePath.slice(0, -3);

    if (
      withoutExtension ===
      normalizedImport
    ) {
      return filePath;
    }

    if (
      withoutExtension.endsWith(
        `/${normalizedImport}`
      )
    ) {
      return filePath;
    }

    if (
      withoutExtension.endsWith(
        `/${normalizedImport}/__init__`
      )
    ) {
      return filePath;
    }
  }

  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Circular Dependency Detection                                              */
/* -------------------------------------------------------------------------- */

function findCycles(
  dependencies: Dependency[],
  pathSet: Set<string>
) {
  const graph = new Map<
    string,
    string[]
  >();

  for (const file of pathSet) {
    graph.set(file, []);
  }

  for (const dependency of dependencies) {
    if (
      !pathSet.has(dependency.source) ||
      !pathSet.has(dependency.target)
    ) {
      continue;
    }

    const targets =
      graph.get(dependency.source) ?? [];

    if (!targets.includes(dependency.target)) {
      targets.push(dependency.target);
    }

    graph.set(
      dependency.source,
      targets
    );
  }

  const cycles: string[][] = [];
  const seenCycles = new Set<string>();

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string) {
    if (visiting.has(node)) {
      const cycleStart =
        stack.indexOf(node);

      if (cycleStart !== -1) {
        const cycle = stack.slice(
          cycleStart
        );

        const normalized =
          normalizeCycle(cycle);

        const key =
          normalized.join("|");

        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          cycles.push(normalized);
        }
      }

      return;
    }

    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    stack.push(node);

    for (
      const target of
        graph.get(node) ?? []
    ) {
      dfs(target);
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

function normalizeCycle(
  cycle: string[]
) {
  if (cycle.length <= 1) {
    return cycle;
  }

  let best = cycle;

  for (
    let i = 1;
    i < cycle.length;
    i++
  ) {
    const rotated = [
      ...cycle.slice(i),
      ...cycle.slice(0, i),
    ];

    if (
      rotated.join("|") <
      best.join("|")
    ) {
      best = rotated;
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/* Potentially Unused / Dead Module Detection                                 */
/* -------------------------------------------------------------------------- */

function findPotentiallyUnusedFiles(
  files: AnalyzedFile[],
  dependencies: Dependency[],
  pathSet: Set<string>
) {
  const incoming = new Set<string>();

  for (const dependency of dependencies) {
    if (
      !pathSet.has(dependency.source) ||
      !pathSet.has(dependency.target)
    ) {
      continue;
    }

    incoming.add(dependency.target);
  }

  return files
    .filter((file) => {
      if (file.isEntryPoint) {
        return false;
      }

      if (file.layer === "test") {
        return false;
      }

      return !incoming.has(file.path);
    })
    .map((file) => file.path);
}