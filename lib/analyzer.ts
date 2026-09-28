import type { RepositoryFile } from "./types";

type AnalyzedFile = {
  path: string;
  language: "python" | "javascript" | "typescript" | "json" | "unknown";
  imports: string[];
  internalImports: string[];
  externalImports: string[];
  layer: string;
  isEntryPoint: boolean;
};

type Dependency = {
  source: string;
  target: string;
  type: "internal" | "external";
};

export function analyzeRepository(files: RepositoryFile[]) {
  const allPaths = files.map((file) => normalizePath(file.path));

  const analyzedFiles: AnalyzedFile[] = files.map((file) => {
    const language = detectLanguage(file.path);
    const imports = extractImports(file.content, file.path);

    const internalImports = imports.filter((imp) =>
      isInternalImport(imp, file.path, allPaths)
    );

    const externalImports = imports.filter(
      (imp) => !internalImports.includes(imp)
    );

    return {
      path: file.path,
      language,
      imports,
      internalImports,
      externalImports,
      layer: detectLayer(file.path),
      isEntryPoint: detectEntryPoint(file.path),
    };
  });

  const dependencies = buildDependencies(analyzedFiles);

  const externalDependencies = [
    ...new Set(
      analyzedFiles.flatMap((file) =>
        file.externalImports.map(normalizeExternalDependency)
      )
    ),
  ].filter(Boolean);

  const entryPoints = analyzedFiles
    .filter((file) => file.isEntryPoint)
    .map((file) => file.path);

  const layers = [
    ...new Set(
      analyzedFiles
        .map((file) => file.layer)
        .filter((layer) => layer !== "unknown")
    ),
  ];

  const languageCounts = analyzedFiles.reduce<
    Record<string, number>
  >((counts, file) => {
    counts[file.language] = (counts[file.language] || 0) + 1;
    return counts;
  }, {});

  return {
    metrics: {
      fileCount: files.length,
      dependencyCount: dependencies.length,
      internalDependencyCount: dependencies.filter(
        (dependency) => dependency.type === "internal"
      ).length,
      externalDependencyCount: externalDependencies.length,
      entryPointCount: entryPoints.length,
      layerCount: layers.length,
    },

    languages: languageCounts,

    layers,

    entryPoints,

    externalDependencies,

    files: analyzedFiles,

    dependencies,
  };
}

function detectLanguage(
  path: string
): AnalyzedFile["language"] {
  if (path.endsWith(".py")) return "python";

  if (path.endsWith(".ts") || path.endsWith(".tsx")) {
    return "typescript";
  }

  if (path.endsWith(".js") || path.endsWith(".jsx")) {
    return "javascript";
  }

  if (path.endsWith(".json")) return "json";

  return "unknown";
}

function extractImports(
  content: string,
  path: string
): string[] {
  const imports: string[] = [];

  if (path.endsWith(".py")) {
    const pythonMatches = content.match(
      /^(?:from|import)\s+([a-zA-Z0-9_./-]+)/gm
    );

    if (pythonMatches) {
      for (const match of pythonMatches) {
        const value = match
          .replace(/^(from|import)\s+/, "")
          .trim();

        if (value) {
          imports.push(value);
        }
      }
    }
  }

  if (
    path.endsWith(".js") ||
    path.endsWith(".ts") ||
    path.endsWith(".tsx") ||
    path.endsWith(".jsx")
  ) {
    const importMatches = content.matchAll(
      /import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g
    );

    for (const match of importMatches) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }

    const requireMatches = content.matchAll(
      /require\(["']([^"']+)["']\)/g
    );

    for (const match of requireMatches) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }

    const dynamicImportMatches = content.matchAll(
      /import\(["']([^"']+)["']\)/g
    );

    for (const match of dynamicImportMatches) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
  }

  return [...new Set(imports)];
}

function isInternalImport(
  importPath: string,
  currentFile: string,
  allPaths: string[]
) {
  if (
    importPath.startsWith(".") ||
    importPath.startsWith("@/")
  ) {
    return true;
  }

  if (currentFile.endsWith(".py")) {
    return allPaths.some((path) => {
      const modulePath = path
        .replace(/\.py$/, "")
        .replace(/\//g, ".");

      return (
        importPath === modulePath ||
        importPath.startsWith(`${modulePath}.`)
      );
    });
  }

  return false;
}

function detectLayer(path: string) {
  const lower = path.toLowerCase();

  if (
    lower.includes("api") ||
    lower.includes("route") ||
    lower.includes("controller") ||
    lower.includes("endpoint")
  ) {
    return "api";
  }

  if (
    lower.includes("service") ||
    lower.includes("usecase") ||
    lower.includes("use-case")
  ) {
    return "service";
  }

  if (
    lower.includes("model") ||
    lower.includes("schema") ||
    lower.includes("entity")
  ) {
    return "model";
  }

  if (
    lower.includes("middleware") ||
    lower.includes("auth")
  ) {
    return "middleware";
  }

  if (
    lower.includes("database") ||
    lower.includes("db") ||
    lower.includes("repository")
  ) {
    return "data";
  }

  if (
    lower.includes("util") ||
    lower.includes("helper") ||
    lower.includes("lib")
  ) {
    return "utility";
  }

  if (
    lower.includes("test") ||
    lower.includes("spec")
  ) {
    return "test";
  }

  return "unknown";
}

function detectEntryPoint(path: string) {
  const lower = normalizePath(path).toLowerCase();

  const entryPointNames = [
    "main.py",
    "app.py",
    "server.py",
    "index.js",
    "index.ts",
    "index.tsx",
    "main.js",
    "main.ts",
    "server.js",
    "server.ts",
  ];

  const fileName = lower.split("/").pop() || "";

  if (entryPointNames.includes(fileName)) {
    return true;
  }

  if (
    lower.includes("/routes/") ||
    lower.includes("/api/") ||
    lower.includes("/controllers/")
  ) {
    return true;
  }

  return false;
}

function buildDependencies(
  files: AnalyzedFile[]
): Dependency[] {
  const dependencies: Dependency[] = [];

  for (const file of files) {
    for (const importPath of file.internalImports) {
      const target = resolveInternalImport(
        file.path,
        importPath,
        files
      );

      if (!target) continue;

      dependencies.push({
        source: file.path,
        target,
        type: "internal",
      });
    }

    for (const importPath of file.externalImports) {
      dependencies.push({
        source: file.path,
        target: normalizeExternalDependency(importPath),
        type: "external",
      });
    }
  }

  return deduplicateDependencies(dependencies);
}

function resolveInternalImport(
  currentFile: string,
  importPath: string,
  files: AnalyzedFile[]
) {
  if (importPath.startsWith("@/")) {
    const possiblePath = importPath
      .replace(/^@\//, "")
      .replace(/\/$/, "");

    return findMatchingFile(possiblePath, files);
  }

  if (importPath.startsWith(".")) {
    const currentDirectory = currentFile.includes("/")
      ? currentFile.substring(
          0,
          currentFile.lastIndexOf("/")
        )
      : "";

    const combined = normalizePath(
      `${currentDirectory}/${importPath}`
    );

    return findMatchingFile(combined, files);
  }

  if (currentFile.endsWith(".py")) {
    const pythonPath = importPath.replace(/\./g, "/");

    return findMatchingFile(pythonPath, files);
  }

  return null;
}

function findMatchingFile(
  basePath: string,
  files: AnalyzedFile[]
) {
  const normalized = normalizePath(basePath)
    .replace(/^\/+/, "");

  const candidates = [
    normalized,
    `${normalized}.ts`,
    `${normalized}.tsx`,
    `${normalized}.js`,
    `${normalized}.jsx`,
    `${normalized}.py`,
    `${normalized}/index.ts`,
    `${normalized}/index.tsx`,
    `${normalized}/index.js`,
    `${normalized}/index.jsx`,
    `${normalized}/__init__.py`,
  ];

  return (
    files.find((file) =>
      candidates.includes(normalizePath(file.path))
    )?.path || null
  );
}

function normalizeExternalDependency(value: string) {
  if (!value) return "";

  if (
    value.startsWith(".") ||
    value.startsWith("@/")
  ) {
    return "";
  }

  if (value.startsWith("@")) {
    const parts = value.split("/");

    return parts.length >= 2
      ? `${parts[0]}/${parts[1]}`
      : value;
  }

  return value.split("/")[0];
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function deduplicateDependencies(
  dependencies: Dependency[]
) {
  const seen = new Set<string>();
  const result: Dependency[] = [];

  for (const dependency of dependencies) {
    const key = `${dependency.type}:${dependency.source}:${dependency.target}`;

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(dependency);
  }

  return result;
}