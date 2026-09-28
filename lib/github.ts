import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export function parseGitHubUrl(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url.trim());
  } catch {
    throw new Error(
      "Please enter a valid GitHub repository URL."
    );
  }

  if (
    parsedUrl.hostname !== "github.com" &&
    parsedUrl.hostname !== "www.github.com"
  ) {
    throw new Error(
      "Please enter a GitHub repository URL, for example: https://github.com/psf/requests"
    );
  }

  const parts = parsedUrl.pathname
    .split("/")
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error(
      "Please enter a complete GitHub repository URL, for example: https://github.com/psf/requests"
    );
  }

  const owner = parts[0];
  const repo = parts[1]
    .replace(/\.git$/, "")
    .trim();

  if (!owner || !repo) {
    throw new Error(
      "Could not determine the GitHub owner and repository."
    );
  }

  return {
    owner,
    repo,
  };
}

export async function getRepositoryFiles(url: string) {
  const { owner, repo } = parseGitHubUrl(url);

  let response;

  try {
    response = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: "HEAD",
      recursive: "true",
    });
  } catch (error: any) {
    console.error("GitHub repository error:", error);

    const status = error?.status;

    if (status === 404) {
      throw new Error(
        `Repository "${owner}/${repo}" was not found or cannot be accessed. Make sure the repository is public and the URL is correct.`
      );
    }

    if (status === 403) {
      throw new Error(
        "GitHub access was denied or the API rate limit was reached. Please try again later."
      );
    }

    if (status === 401) {
      throw new Error(
        "GitHub authentication failed. Please check your GITHUB_TOKEN."
      );
    }

    throw new Error(
      "Unable to access this GitHub repository."
    );
  }

  const files = response.data.tree
    .filter(
      (item) =>
        item.type === "blob" &&
        item.path &&
        !item.path.includes("node_modules") &&
        !item.path.includes(".git") &&
        !item.path.includes("__pycache__") &&
        !item.path.includes(".venv") &&
        !item.path.includes("venv") &&
        !item.path.includes("dist") &&
        !item.path.includes("build")
    )
    .filter((item) =>
      /\.(py|js|ts|tsx|jsx|json)$/.test(item.path || "")
    );

  if (files.length === 0) {
    throw new Error(
      "No supported source files were found. ArchLens currently supports Python, JavaScript, and TypeScript repositories."
    );
  }

  const results = [];

  for (const file of files.slice(0, 50)) {
    if (!file.path) continue;

    try {
      const contentResponse =
        await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file.path,
        });

      if (
        !Array.isArray(contentResponse.data) &&
        "content" in contentResponse.data
      ) {
        const content = Buffer.from(
          contentResponse.data.content,
          "base64"
        ).toString("utf-8");

        results.push({
          path: file.path,
          content,
        });
      }
    } catch (error) {
      console.warn(
        `Could not read file: ${file.path}`,
        error
      );
    }
  }

  if (results.length === 0) {
    throw new Error(
      "The repository was found, but ArchLens could not read any supported source files."
    );
  }

  return results;
}