// GitHub Contents API helper for reading/writing files to the wiki repo.

const GITHUB_API = "https://api.github.com";

function getConfig() {
  const token = Deno.env.get("GITHUB_TOKEN") || Deno.env.get("GH_TOKEN");
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

/** Read a file at a specific git ref (commit SHA, branch, tag). */
export async function readFileAtRef(path: string, ref: string): Promise<{ content: string; sha: string } | null> {
  const { token, owner, repo } = getConfig();
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    { headers: headers(token) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return { content, sha: data.sha };
}

/** Get commit history for a specific file. */
export async function getFileCommits(path: string, perPage = 20): Promise<{ sha: string; message: string; date: string; author: string }[]> {
  const { token, owner, repo } = getConfig();
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=${perPage}`,
    { headers: headers(token) },
  );
  if (!res.ok) return [];
  const commits = await res.json();
  return commits.map((c: { sha: string; commit: { message: string; author: { date: string; name: string } } }) => ({
    sha: c.sha,
    message: c.commit.message,
    date: c.commit.author.date,
    author: c.commit.author.name,
  }));
}

/** Get recent commits that touched articles. Returns slug -> latest commit SHA. */
export async function getRecentArticleCommits(since?: string): Promise<{ slug: string; sha: string; date: string }[]> {
  const { token, owner, repo } = getConfig();
  const params = new URLSearchParams({ path: "articles", per_page: "30" });
  if (since) params.set("since", since);
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?${params}`,
    { headers: headers(token) },
  );
  if (!res.ok) return [];
  const commits = await res.json();
  const results: { slug: string; sha: string; date: string }[] = [];
  const seen = new Set<string>();
  for (const commit of commits) {
    // Get files changed in this commit
    const detailRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/commits/${commit.sha}`,
      { headers: headers(token) },
    );
    if (!detailRes.ok) continue;
    const detail = await detailRes.json();
    for (const file of detail.files || []) {
      const match = file.filename.match(/^articles\/(.+)\.md$/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        results.push({ slug: match[1], sha: commit.sha, date: commit.commit.author.date });
      }
    }
  }
  return results;
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

/** Write multiple files in a single commit using the Git Trees API. */
export async function writeMultipleFiles(
  files: { path: string; content: string }[],
  message: string,
): Promise<{ commitSha: string }> {
  const { token, owner, repo } = getConfig();
  const h = headers(token);
  const base = `${GITHUB_API}/repos/${owner}/${repo}`;

  // 1. Get the SHA of the latest commit on the default branch
  const refRes = await fetch(`${base}/git/ref/heads/main`, { headers: h });
  if (!refRes.ok) throw new Error(`GitHub API error getting ref: ${refRes.status}`);
  const refData = await refRes.json();
  const baseCommitSha = refData.object.sha;

  // 2. Get the tree SHA of that commit
  const commitRes = await fetch(`${base}/git/commits/${baseCommitSha}`, { headers: h });
  if (!commitRes.ok) throw new Error(`GitHub API error getting commit: ${commitRes.status}`);
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for each file
  const tree = [];
  for (const file of files) {
    const blobRes = await fetch(`${base}/git/blobs`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
    });
    if (!blobRes.ok) throw new Error(`GitHub API error creating blob: ${blobRes.status}`);
    const blobData = await blobRes.json();
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blobData.sha });
  }

  // 4. Create a new tree
  const treeRes = await fetch(`${base}/git/trees`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!treeRes.ok) throw new Error(`GitHub API error creating tree: ${treeRes.status}`);
  const treeData = await treeRes.json();

  // 5. Create a new commit
  const newCommitRes = await fetch(`${base}/git/commits`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [baseCommitSha],
    }),
  });
  if (!newCommitRes.ok) throw new Error(`GitHub API error creating commit: ${newCommitRes.status}`);
  const newCommitData = await newCommitRes.json();

  // 6. Update the ref
  const updateRefRes = await fetch(`${base}/git/refs/heads/main`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
  if (!updateRefRes.ok) throw new Error(`GitHub API error updating ref: ${updateRefRes.status}`);

  return { commitSha: newCommitData.sha };
}
