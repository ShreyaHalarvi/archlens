import type { RepositoryFile } from "./types";

const API = "https://api.github.com";

function parseGitHubUrl(value: string) {
  const url = new URL(value.trim());
  if (url.hostname !== "github.com") {
    throw new Error("Please provide a github.com repository URL.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("GitHub URL must look like https://github.com/owner/repository");
  }
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
}

async function githubFetch(
  path: string,
  token?: string
): Promise<Response> {
  return fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ArchLens",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
}

export async function getRepositoryFiles(
  githubUrl: string
): Promise<{ owner: string; repo: string; files: RepositoryFile[] }> {
  const { owner, repo } = parseGitHubUrl(githubUrl);
  const token = process.env.GITHUB_TOKEN;

  const repoResponse = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    token
  );

  if (!repoResponse.ok) {
    const body = await repoResponse.text();
    throw new Error(
      `GitHub repository request failed (${repoResponse.status}): ${body.slice(0, 300)}`
    );
  }

  const repoData = await repoResponse.json();
  const branch = repoData.default_branch || "main";

  const treeResponse = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token
  );

  if (!treeResponse.ok) {
    throw new Error(`Could not read the repository tree (${treeResponse.status}).`);
  }

  const treeData = await treeResponse.json();

  if (treeData.truncated) {
    throw new Error(
      "GitHub returned a truncated repository tree. Try a smaller repository."
    );
  }

  const candidates = (treeData.tree || [])
    .filter((item: any) => item.type === "blob")
    .map((item: any) => item.path as string)
    .filter(isUsefulSourceFile)
    .slice(0, 120);

  const files: RepositoryFile[] = [];

  for (const path of candidates) {
    const blobResponse = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
      token
    );

    if (!blobResponse.ok) continue;

    const blob = await blobResponse.json();

    if (blob.encoding !== "base64" || typeof blob.content !== "string") {
      continue;
    }

    try {
      const content = Buffer.from(blob.content, "base64").toString("utf8");
      if (content.length <= 120_000) {
        files.push({ path, content });
      }
    } catch {
      // Ignore binary/unreadable files.
    }
  }

  if (files.length === 0) {
    throw new Error("No readable source files were found in the repository.");
  }

  return { owner, repo, files };
}

function isUsefulSourceFile(path: string) {
  const lower = path.toLowerCase();

  if (
    lower.includes("node_modules/") ||
    lower.includes(".git/") ||
    lower.includes("dist/") ||
    lower.includes("build/") ||
    lower.includes(".next/") ||
    lower.includes("coverage/")
  ) {
    return false;
  }

  return /\.(py|js|jsx|ts|tsx|mjs|cjs|json)$/.test(lower);
}
