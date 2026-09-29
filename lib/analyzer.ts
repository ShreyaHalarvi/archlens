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

export function analyzeRepository(repositoryFiles: RepositoryFile[]) {
  const files = repositoryFiles.map(analyzeFile);
  const pathSet = new Set(files.map((file) => file.path));
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

  const uniqueDependencies = dedupeDependencies(dependencies);
  const languageCounts: Record<string, number> = {};
  for (const file of files) {
    languageCounts[file.language] = (languageCounts[file.language] || 0) + 1;
  }

  const layers = [...new Set(files.map((file) => file.layer))].filter(
    (layer) => layer !== "unknown"
  );

  const entryPoints = files
    .filter((file) => file.isEntryPoint)
    .map((file) => file.path);

  const externalDependencies = [
    ...new Set(
      files.flatMap((file) => file.externalImports.map(normalizePackage))
    ),
  ].filter(Boolean);

  return {
    metrics: {
      fileCount: files.length,
      dependencyCount: uniqueDependencies.length,
      internalDependencyCount: uniqueDependencies.filter((d) => d.type === "internal").length,
      externalDependencyCount: uniqueDependencies.filter((d) => d.type === "external").length,
      entryPointCount: entryPoints.length,
      layerCount: layers.length,
    },
    languages: languageCounts,
    layers,
    entryPoints,
    externalDependencies,
    files,
    dependencies: uniqueDependencies,
  };
}

function analyzeFile(file: RepositoryFile): AnalyzedFile {
  const language = detectLanguage(file.path);
  const imports = extractImports(file.content, language);
  const internalImports = imports.filter((item) => looksInternal(item, file.path, language));
  const externalImports = imports.filter((item) => !internalImports.includes(item));

  return {
    path: file.path,
    language,
    layer: inferLayer(file.path),
    imports,
    internalImports: internalImports.map((item) =>
      resolveInternalImport(item, file.path, language)
    ),
    externalImports,
    isEntryPoint: isEntryPoint(file.path, file.content, language),
  };
}

function detectLanguage(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return LANGUAGE_BY_EXT[ext] || "Other";
}

function extractImports(content: string, language: string) {
  const found = new Set<string>();

  if (language === "Python") {
    for (const match of content.matchAll(/^\s*(?:from|import)\s+([A-Za-z0-9_@./-]+)/gm)) {
      found.add(match[1]);
    }
  } else if (language === "JavaScript" || language === "TypeScript") {
    for (const match of content.matchAll(/(?:import\s+(?:[\s\S]*?\s+from\s+)?|require\s*\(\s*|import\s*\(\s*)["']([^"']+)["']/g)) {
      found.add(match[1]);
    }
  }

  return [...found].slice(0, 40);
}

function looksInternal(importPath: string, sourcePath: string, language: string) {
  if (importPath.startsWith(".") || importPath.startsWith("/")) return true;

  if (language === "Python") {
    const sourceDir = sourcePath.split("/").slice(0, -1).join("/");
    const first = importPath.split(".")[0];
    return sourceDir.split("/").includes(first) || importPath.startsWith("src.");
  }

  return false;
}

function resolveInternalImport(
  importPath: string,
  sourcePath: string,
  language: string
) {
  if (language === "Python" && !importPath.startsWith(".")) {
    return importPath.replace(/\./g, "/") + ".py";
  }

  const base = sourcePath.split("/").slice(0, -1).join("/");
  const raw = importPath.replace(/^@\//, "");
  const joined = normalizePath(`${base}/${raw}`);
  return joined;
}

function normalizePath(value: string) {
  const parts: string[] = [];
  for (const part of value.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function inferLayer(path: string) {
  const p = path.toLowerCase();
  if (/(^|\/)(api|routes?|controllers?|endpoints?)(\/|\.|$)/.test(p)) return "api";
  if (/(^|\/)(services?|usecases?|handlers?)(\/|\.|$)/.test(p)) return "service";
  if (/(^|\/)(models?|schemas?|entities?)(\/|\.|$)/.test(p)) return "model";
  if (/(^|\/)(middleware|middlewares)(\/|\.|$)/.test(p)) return "middleware";
  if (/(^|\/)(db|database|data|repositories?|storage)(\/|\.|$)/.test(p)) return "database";
  if (/(^|\/)(utils?|utilities?|helpers?|lib)(\/|\.|$)/.test(p)) return "utility";
  if (/(^|\/)(test|tests|__tests__)(\/|\.|$)/.test(p)) return "test";
  return "unknown";
}

function isEntryPoint(path: string, content: string, language: string) {
  const p = path.toLowerCase();
  if (/(^|\/)(main|app|server|index)\.(py|js|jsx|ts|tsx|mjs|cjs)$/.test(p)) return true;
  if (/(routes?|controllers?|api|endpoints?)/.test(p)) return true;
  if (language === "Python" && /if\s+__name__\s*==\s*["']__main__["']/.test(content)) return true;
  return false;
}

function normalizePackage(value: string) {
  if (value.startsWith("@")) {
    const parts = value.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : value;
  }
  return value.split("/")[0].split(".")[0];
}

function dedupeDependencies(dependencies: Dependency[]) {
  const seen = new Set<string>();
  return dependencies.filter((dependency) => {
    const key = `${dependency.source}|${dependency.target}|${dependency.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
