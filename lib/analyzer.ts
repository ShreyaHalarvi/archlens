import type { RepositoryFile } from "./types";

export function analyzeRepository(files: RepositoryFile[]) {
  const analyzedFiles = files.map((file) => ({
    path: file.path,
    imports: extractImports(file.content, file.path),
  }));

  return {
    files: analyzedFiles,
    fileCount: files.length,
  };
}

function extractImports(content: string, path: string): string[] {
  const imports: string[] = [];

  // Python imports
  if (path.endsWith(".py")) {
    const pythonImports = content.match(
      /^(?:from|import)\s+([a-zA-Z0-9_./-]+)/gm
    );

    if (pythonImports) {
      imports.push(...pythonImports);
    }
  }

  // JavaScript / TypeScript imports
  if (
    path.endsWith(".js") ||
    path.endsWith(".ts") ||
    path.endsWith(".tsx") ||
    path.endsWith(".jsx")
  ) {
    const jsImports = content.match(
      /(?:import.*from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g
    );

    if (jsImports) {
      imports.push(...jsImports);
    }
  }

  return imports;
}