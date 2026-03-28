// GitHub Contents API helper for reading/writing files to the wiki repo.

const GITHUB_API = "https://api.github.com";

function getConfig() {
  const token = Deno.env.get("GITHUB_TOKEN");
  const owner = Deno.env.get("GITHUB_OWNER");
  const repo = Deno.env.get("GITHUB_REPO");
  if (!token || !owner || !repo) {
    throw new Error("Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO env vars");
  }
  return { token, owner, repo };
}

function headers(token: string): HeadersInit {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  content?: string; // base64 encoded
  type: "file" | "dir";
}

/** Read a file from the repo. Returns null if not found. */
export async function readFile(path: string): Promise<{ content: string; sha: string } | null> {
  const { token, owner, repo } = getConfig();
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    { headers: headers(token) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return { content, sha: data.sha };
}

/** List files in a directory. Returns empty array if not found. */
export async function listDir(path: string): Promise<GitHubFile[]> {
  const { token, owner, repo } = getConfig();
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    { headers: headers(token) },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  return await res.json();
}

/** Create or update a file. If sha is provided, it's an update. */
export async function writeFile(
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ sha: string; commitSha: string }> {
  const { token, owner, repo } = getConfig();
  const body: Record<string, string> = {
    message,
    content: btoa(content),
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { sha: data.content.sha, commitSha: data.commit.sha };
}
