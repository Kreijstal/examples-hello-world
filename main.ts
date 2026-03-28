import { readFile, readFileAtRef, writeFile, writeMultipleFiles, listDir, getRecentArticleCommits, getFileCommits } from "./github.ts";
import { encode as toonEncode, decode as toonDecode } from "npm:@toon-format/toon";
import { marked } from "npm:marked";
import { loadTemplates, expandTemplates } from "./templates.ts";

// Load templates on startup
await loadTemplates("templates");

// In-memory cache of recent edits for the freshness API.
// Maps slug -> { revision, content, updatedAt }
const recentEdits = new Map<string, { revision: string; content: string; updatedAt: string }>();

function getClientIP(req: Request, info?: Deno.ServeHandlerInfo): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? (info?.remoteAddr && "hostname" in info.remoteAddr ? info.remoteAddr.hostname : undefined)
    ?? "unknown";
}

function json(data: unknown, status = 200, cacheControl?: string): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  return new Response(JSON.stringify(data), { status, headers });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// --- Route matching ---

interface RouteMatch {
  params: Record<string, string>;
}

function matchRoute(pattern: string, pathname: string): RouteMatch | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":") && patternParts[i].endsWith("*")) {
      // Rest parameter — captures everything remaining
      const name = patternParts[i].slice(1, -1);
      params[name] = pathParts.slice(i).map(decodeURIComponent).join("/");
      return { params };
    } else if (patternParts[i].startsWith(":")) {
      if (i >= pathParts.length) return null;
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  if (patternParts.length !== pathParts.length) return null;
  return { params };
}

// --- Handlers ---

async function handleEdit(req: Request, slug: string, info?: Deno.ServeHandlerInfo): Promise<Response> {
  const ip = getClientIP(req, info);

  // Check blocklist
  const block = await readFile(`blocks/${ip}.toon`);
  if (block) return err("Your IP is blocked from editing.", 403);

  const body = await req.json();
  const content: string = body.content;
  const summary: string = body.summary ?? "edit";
  if (!content) return err("Missing 'content' field.");

  // Read existing article (if any) to get SHA for update
  const existing = await readFile(`articles/${slug}.md`);

  const now = new Date();
  const timestamp = now.toISOString();
  const revisionId = timestamp.replace(/[:.]/g, "-");

  // Build article frontmatter + body
  const articleContent = `---
title: "${slug.replace(/-/g, " ")}"
slug: "${slug}"
updated_at: "${timestamp}"
latest_revision: "${revisionId}"
---

${content}
`;

  // Commit article + revision metadata in a single commit
  const revision = {
    article: slug,
    edited_at: timestamp,
    ip,
    user_agent: req.headers.get("user-agent") ?? "",
    summary,
    previous_revision: existing ? extractFrontmatter(existing.content).latest_revision ?? null : null,
  };

  await writeMultipleFiles([
    { path: `articles/${slug}.md`, content: articleContent },
    { path: `revisions/${slug}/${revisionId}.toon`, content: toonEncode(revision) },
  ], `Edit ${slug}: ${summary}`);

  // Cache for freshness
  recentEdits.set(slug, { revision: revisionId, content, updatedAt: timestamp });

  return json({ ok: true, revision: revisionId });
}

async function handleRevert(_req: Request, slug: string, revisionId: string, info?: Deno.ServeHandlerInfo): Promise<Response> {
  // Read the revision metadata to find what we're reverting to
  const revFile = await readFile(`revisions/${slug}/${revisionId}.toon`);
  if (!revFile) return err("Revision not found.", 404);

  // We need to reconstruct the article content at that revision.
  // Since we store full article content in the article file and revisions are sequential,
  // the simplest approach: read the article file at that commit.
  // But via Contents API we can only read HEAD. So instead, we re-apply:
  // For v1, revert means: the admin provides the content to restore.
  // Alternative: store full content snapshots in revisions.

  // For now, revert by reading the target revision's previous state is hard without
  // git history access. Let's use a pragmatic approach: the revert request includes content.
  const body = await _req.json();
  const content: string = body.content;
  if (!content) return err("Revert requires 'content' field with the article body to restore.");

  const ip = getClientIP(_req, info);
  const existing = await readFile(`articles/${slug}.md`);
  if (!existing) return err("Article not found.", 404);

  const now = new Date();
  const timestamp = now.toISOString();
  const newRevisionId = timestamp.replace(/[:.]/g, "-");

  const articleContent = `---
title: "${slug.replace(/-/g, " ")}"
slug: "${slug}"
updated_at: "${timestamp}"
latest_revision: "${newRevisionId}"
---

${content}
`;

  const revision = {
    article: slug,
    edited_at: timestamp,
    ip,
    user_agent: _req.headers.get("user-agent") ?? "",
    summary: `Reverted to ${revisionId}`,
    previous_revision: extractFrontmatter(existing.content).latest_revision ?? null,
    reverted_to: revisionId,
  };

  await writeMultipleFiles([
    { path: `articles/${slug}.md`, content: articleContent },
    { path: `revisions/${slug}/${newRevisionId}.toon`, content: toonEncode(revision) },
  ], `Revert ${slug} to ${revisionId}`);

  recentEdits.set(slug, { revision: newRevisionId, content, updatedAt: timestamp });

  return json({ ok: true, revision: newRevisionId });
}

async function handleBlockIP(req: Request): Promise<Response> {
  const body = await req.json();
  const ip: string = body.ip;
  const reason: string = body.reason ?? "blocked";
  if (!ip) return err("Missing 'ip' field.");

  const existing = await readFile(`blocks/${ip}.toon`);
  const blockData = {
    ip,
    blocked_at: new Date().toISOString(),
    reason,
  };

  await writeFile(
    `blocks/${ip}.toon`,
    toonEncode(blockData),
    `Block IP ${ip}: ${reason}`,
    existing?.sha,
  );

  return json({ ok: true });
}

async function handleGetDiscussion(slug: string): Promise<Response> {
  const files = await listDir(`discussions/${slug}`);
  if (files.length === 0) return json([]);

  const comments = [];
  for (const f of files) {
    if (f.type !== "file" || !f.name.endsWith(".toon")) continue;
    const file = await readFile(`discussions/${slug}/${f.name}`);
    if (!file) continue;
    const data = toonDecode(file.content) as Record<string, unknown>;
    comments.push({ id: f.name.replace(".toon", ""), ...data });
  }
  comments.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
  return json(comments);
}

async function handlePostDiscussion(req: Request, slug: string, info?: Deno.ServeHandlerInfo): Promise<Response> {
  const ip = getClientIP(req, info);

  const block = await readFile(`blocks/${ip}.toon`);
  if (block) return err("Your IP is blocked.", 403);

  const body = await req.json();
  const message: string = body.message;
  if (!message || !message.trim()) return err("Missing 'message' field.");

  const now = new Date();
  const timestamp = now.toISOString();
  const commentId = timestamp.replace(/[:.]/g, "-");

  const comment = {
    article: slug,
    posted_at: timestamp,
    ip,
    user_agent: req.headers.get("user-agent") ?? "",
    message: message.trim(),
  };

  await writeFile(
    `discussions/${slug}/${commentId}.toon`,
    toonEncode(comment),
    `Discussion comment on ${slug}`,
  );

  return json({ ok: true, id: commentId });
}

async function handleFreshness(): Promise<Response> {
  // Combine in-memory recent edits with recent GitHub commits
  const articles: Record<string, string> = {};
  for (const [slug, data] of recentEdits) {
    articles[slug] = data.revision;
  }
  // Also check GitHub for commits in the last 10 minutes
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recentCommits = await getRecentArticleCommits(since);
    for (const { slug, sha } of recentCommits) {
      if (!articles[slug]) {
        articles[slug] = sha;
      }
    }
  } catch {
    // If GitHub API fails, just use in-memory data
  }
  return json({ articles }, 200, "public, max-age=15, stale-while-revalidate=60");
}

async function handleArticle(slug: string): Promise<Response> {
  let content: string;
  let revision: string;
  let updatedAt: string;

  const cached = recentEdits.get(slug);
  if (cached) {
    content = cached.content;
    revision = cached.revision;
    updatedAt = cached.updatedAt;
  } else {
    try {
      const file = await readFile(`articles/${slug}.md`);
      if (!file) return err("Article not found.", 404);
      const fm = extractFrontmatter(file.content);
      content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, "");
      revision = fm.latest_revision || file.sha;
      updatedAt = fm.updated_at || "";
    } catch {
      return err("Could not fetch article.", 500);
    }
  }

  const html = await marked.parse(expandTemplates(content));
  return json({ slug, revision, content, html, updatedAt });
}

async function handleGetRevisions(slug: string): Promise<Response> {
  const files = await listDir(`revisions/${slug}`);
  if (files.length === 0) return json([]);

  // Return revision list sorted by name (timestamp-based)
  const revisions = files
    .filter((f) => f.type === "file" && f.name.endsWith(".toon"))
    .map((f) => ({ id: f.name.replace(".toon", ""), path: f.path }))
    .sort((a, b) => b.id.localeCompare(a.id));

  return json(revisions);
}

/** Returns commit history for an article with content at each commit for diffing. */
async function handleArticleHistory(slug: string): Promise<Response> {
  const commits = await getFileCommits(`articles/${slug}.md`, 30);
  const history = [];
  for (const commit of commits) {
    const file = await readFileAtRef(`articles/${slug}.md`, commit.sha);
    const body = file ? file.content.replace(/^---\n[\s\S]*?\n---\n?/, "") : null;
    history.push({
      sha: commit.sha,
      message: commit.message,
      date: commit.date,
      author: commit.author,
      content: body,
    });
  }
  return json(history);
}

/** Revert an article to its state at a specific commit SHA. */
async function handleRevertToCommit(req: Request, slug: string, commitSha: string, info?: Deno.ServeHandlerInfo): Promise<Response> {
  const ip = getClientIP(req, info);

  const file = await readFileAtRef(`articles/${slug}.md`, commitSha);
  if (!file) return err("Article not found at that commit.", 404);

  const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const existing = await readFile(`articles/${slug}.md`);
  if (!existing) return err("Article not found.", 404);

  const now = new Date();
  const timestamp = now.toISOString();
  const revisionId = timestamp.replace(/[:.]/g, "-");

  const articleContent = `---
title: "${slug.replace(/-/g, " ")}"
slug: "${slug}"
updated_at: "${timestamp}"
latest_revision: "${revisionId}"
---

${content}
`;

  const revision = {
    article: slug,
    edited_at: timestamp,
    ip,
    user_agent: req.headers.get("user-agent") ?? "",
    summary: `Reverted to commit ${commitSha.slice(0, 7)}`,
    previous_revision: extractFrontmatter(existing.content).latest_revision ?? null,
    reverted_to_commit: commitSha,
  };

  await writeMultipleFiles([
    { path: `articles/${slug}.md`, content: articleContent },
    { path: `revisions/${slug}/${revisionId}.toon`, content: toonEncode(revision) },
  ], `Revert ${slug} to commit ${commitSha.slice(0, 7)}`);

  recentEdits.set(slug, { revision: revisionId, content, updatedAt: timestamp });

  return json({ ok: true, revision: revisionId });
}

// --- Frontmatter parser ---

function extractFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      result[key] = val;
    }
  }
  return result;
}

// --- Main server ---

Deno.serve(async (req: Request, info: Deno.ServeHandlerInfo) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS for browser access
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const corsHeaders = { "Access-Control-Allow-Origin": "*" };

  try {
    // GET /api/debug/env — check which env vars are set (not their values)
    if (req.method === "GET" && path === "/api/debug/env") {
      const vars = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GH_TOKEN"];
      const status: Record<string, string | boolean> = {};
      for (const v of vars) {
        const val = Deno.env.get(v);
        status[v] = val ? `set (${val.length} chars)` : false;
      }
      // Also list all env var names (not values) that contain "GIT" or "TOKEN"
      const allKeys: string[] = [];
      for (const [key] of Object.entries(Deno.env.toObject())) {
        if (key.includes("GIT") || key.includes("TOKEN") || key.includes("GITHUB") || key.includes("DENO")) {
          allKeys.push(key);
        }
      }
      status._relevant_keys = allKeys as unknown as string;
      return json(status);
    }

    // GET /api/freshness
    if (req.method === "GET" && path === "/api/freshness") {
      const res = await handleFreshness();
      for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
      return res;
    }

    // GET /api/article/:slug.../history (must be before /api/article/:slug*)
    if (req.method === "GET" && path.startsWith("/api/article/") && path.endsWith("/history")) {
      const slug = decodeURIComponent(path.slice("/api/article/".length, -"/history".length));
      if (slug) {
        const res = await handleArticleHistory(slug);
        for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
        return res;
      }
    }

    // GET /api/article/:slug
    if (req.method === "GET") {
      const m = matchRoute("/api/article/:slug*", path);
      if (m) {
        const res = await handleArticle(m.params.slug);
        for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
        return res;
      }
    }

    // GET /api/discuss/:slug
    if (req.method === "GET") {
      const m = matchRoute("/api/discuss/:slug*", path);
      if (m) {
        const res = await handleGetDiscussion(m.params.slug);
        for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
        return res;
      }
    }

    // POST /api/discuss/:slug
    if (req.method === "POST") {
      const m = matchRoute("/api/discuss/:slug*", path);
      if (m) {
        const res = await handlePostDiscussion(req, m.params.slug, info);
        for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
        return res;
      }
    }

    // GET /api/revisions/:slug
    if (req.method === "GET") {
      const m = matchRoute("/api/revisions/:slug*", path);
      if (m) {
        const res = await handleGetRevisions(m.params.slug);
        for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
        return res;
      }
    }

    // POST /api/revert-to/:slug.../:sha (SHA is always 40 hex chars)
    if (req.method === "POST" && path.startsWith("/api/revert-to/")) {
      const rest = path.slice("/api/revert-to/".length);
      const lastSlash = rest.lastIndexOf("/");
      if (lastSlash > 0) {
        const slug = decodeURIComponent(rest.slice(0, lastSlash));
        const sha = rest.slice(lastSlash + 1);
        const res = await handleRevertToCommit(req, slug, sha, info);
        for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
        return res;
      }
    }

    // POST /api/edit/:slug
    if (req.method === "POST") {
      const m = matchRoute("/api/edit/:slug*", path);
      if (m) {
        const res = await handleEdit(req, m.params.slug, info);
        for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
        return res;
      }
    }

    // POST /api/revert/:slug.../:revision
    if (req.method === "POST" && path.startsWith("/api/revert/") && !path.startsWith("/api/revert-to/")) {
      const rest = path.slice("/api/revert/".length);
      const lastSlash = rest.lastIndexOf("/");
      if (lastSlash > 0) {
        const slug = decodeURIComponent(rest.slice(0, lastSlash));
        const revision = rest.slice(lastSlash + 1);
        const m = { params: { slug, revision } };
        const res = await handleRevert(req, m.params.slug, m.params.revision, info);
        for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
        return res;
      }
    }

    // POST /api/block-ip
    if (req.method === "POST" && path === "/api/block-ip") {
      const res = await handleBlockIP(req);
      for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
      return res;
    }

    return new Response("Not found", { status: 404 });
  } catch (e) {
    console.error(e);
    return err(e instanceof Error ? e.message : "Internal error", 500);
  }
});
