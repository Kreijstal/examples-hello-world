import { marked } from "npm:marked";
import { join } from "jsr:@std/path";
import { decode as toonDecode } from "npm:@toon-format/toon";

const ARTICLES_DIR = "articles";
const SRC_DIR = "src";
const DIST_DIR = "dist";
const REVISIONS_DIR = "revisions";

// Config — override via env
const API_BASE = Deno.env.get("API_BASE") || "";
const GITHUB_OWNER = Deno.env.get("GITHUB_OWNER") || "";
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") || "";
// Base path for GitHub Pages project sites (e.g. "/examples-hello-world")
const BASE_PATH = (Deno.env.get("BASE_PATH") || "").replace(/\/$/, "");

// --- Helpers ---

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      meta[key] = val;
    }
  }
  return { meta, body: match[2] };
}

async function readArticles() {
  const articles = [];
  for await (const entry of Deno.readDir(ARTICLES_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    const raw = await Deno.readTextFile(join(ARTICLES_DIR, entry.name));
    const { meta, body } = parseFrontmatter(raw);
    articles.push({
      slug: meta.slug || entry.name.replace(".md", ""),
      title: meta.title || entry.name.replace(".md", ""),
      updated_at: meta.updated_at || "",
      latest_revision: meta.latest_revision || "",
      body,
      filename: entry.name,
    });
  }
  // Sort by title
  articles.sort((a, b) => a.title.localeCompare(b.title));
  return articles;
}

async function readRevisions(slug) {
  const dir = join(REVISIONS_DIR, slug);
  const revisions = [];
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (!entry.isFile || !entry.name.endsWith(".toon")) continue;
      const raw = await Deno.readTextFile(join(dir, entry.name));
      const data = toonDecode(raw);
      revisions.push({ id: entry.name.replace(".toon", ""), ...data });
    }
  } catch {
    // No revisions directory yet
  }
  revisions.sort((a, b) => b.id.localeCompare(a.id));
  return revisions;
}

// --- Build ---

async function ensureDir(path) {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch {
    // exists
  }
}

async function build() {
  const template = await Deno.readTextFile(join(SRC_DIR, "template.html"));
  const articles = await readArticles();

  // Clean and create dist
  try { await Deno.remove(DIST_DIR, { recursive: true }); } catch { /* */ }
  await ensureDir(DIST_DIR);

  // Copy static assets (process {{BASE_PATH}} in HTML files)
  await Deno.copyFile(join(SRC_DIR, "styles.css"), join(DIST_DIR, "styles.css"));
  for (const [src, dst] of [
    ["index.html", "index.html"],
    ["search.html", "search/index.html"],
  ]) {
    const dir = join(DIST_DIR, ...dst.split("/").slice(0, -1));
    if (dir !== DIST_DIR) await ensureDir(dir);
    const html = (await Deno.readTextFile(join(SRC_DIR, src))).replaceAll("{{BASE_PATH}}", BASE_PATH);
    await Deno.writeTextFile(join(DIST_DIR, dst), html);
  }

  // Generate search index
  const searchIndex = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    summary: a.body.slice(0, 200).replace(/\n/g, " "),
  }));
  await Deno.writeTextFile(join(DIST_DIR, "search-index.json"), JSON.stringify(searchIndex, null, 2));

  // Generate article pages
  for (const article of articles) {
    const htmlContent = await marked.parse(article.body);
    const page = template
      .replaceAll("{{TITLE}}", article.title)
      .replaceAll("{{SLUG}}", article.slug)
      .replaceAll("{{REVISION}}", article.latest_revision)
      .replaceAll("{{UPDATED_AT}}", article.updated_at)
      .replaceAll("{{CONTENT}}", htmlContent)
      .replaceAll("{{API_BASE}}", API_BASE)
      .replaceAll("{{BASE_PATH}}", BASE_PATH)
      .replaceAll("{{GITHUB_OWNER}}", GITHUB_OWNER)
      .replaceAll("{{GITHUB_REPO}}", GITHUB_REPO);

    const articleDir = join(DIST_DIR, "wiki", article.slug);
    await ensureDir(articleDir);
    await Deno.writeTextFile(join(articleDir, "index.html"), page);

    // Generate history page
    const revisions = await readRevisions(article.slug);
    const historyDir = join(DIST_DIR, "wiki", article.slug, "history");
    await ensureDir(historyDir);
    const historyHtml = generateHistoryPage(article, revisions);
    await Deno.writeTextFile(join(historyDir, "index.html"), historyHtml);
  }

  // All articles page
  await ensureDir(join(DIST_DIR, "all-articles"));
  const allArticlesHtml = generateAllArticlesPage(articles);
  await Deno.writeTextFile(join(DIST_DIR, "all-articles", "index.html"), allArticlesHtml);

  // Recent changes page
  await ensureDir(join(DIST_DIR, "recent-changes"));
  const allRevisions = [];
  for (const article of articles) {
    const revs = await readRevisions(article.slug);
    for (const rev of revs) {
      allRevisions.push({ ...rev, articleTitle: article.title });
    }
  }
  allRevisions.sort((a, b) => (b.edited_at || b.id).localeCompare(a.edited_at || a.id));
  const recentChangesHtml = generateRecentChangesPage(allRevisions.slice(0, 50));
  await Deno.writeTextFile(join(DIST_DIR, "recent-changes", "index.html"), recentChangesHtml);

  console.log(`Built ${articles.length} articles to ${DIST_DIR}/`);
}

// --- Page generators ---

function wrapPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FreeWiki</title>
  <link rel="stylesheet" href="${BASE_PATH}/styles.css">
</head>
<body>
  <div id="header">
    <a href="${BASE_PATH}/" class="logo">FreeWiki<small>The free wiki</small></a>
    <form id="header-search" action="${BASE_PATH}/search/" method="get">
      <input type="text" name="q" placeholder="Search FreeWiki">
      <button type="submit">Search</button>
    </form>
  </div>
  <div id="wrapper">
    <div id="sidebar">
      <h3>Navigation</h3>
      <ul>
        <li><a href="${BASE_PATH}/">Main page</a></li>
        <li><a href="${BASE_PATH}/all-articles/">All articles</a></li>
        <li><a href="${BASE_PATH}/recent-changes/">Recent changes</a></li>
        <li><a href="${BASE_PATH}/search/">Search</a></li>
      </ul>
    </div>
    <div id="content">
      <h1 class="page-title">${title}</h1>
      ${bodyHtml}
    </div>
  </div>
  <div id="footer">
    Content is available under open license. FreeWiki is powered by GitHub and Deno Deploy.
  </div>
</body>
</html>`;
}

function generateAllArticlesPage(articles) {
  const items = articles
    .map((a) => `<li><a href="${BASE_PATH}/wiki/${a.slug}/">${a.title}</a></li>`)
    .join("\n      ");
  return wrapPage("All Articles", `
    <ul class="article-list">
      ${items}
    </ul>`);
}

function generateHistoryPage(article, revisions) {
  const rows = revisions.length === 0
    ? "<p>No revision history yet.</p>"
    : revisions
        .map(
          (r) =>
            `<tr>
          <td>${r.id}</td>
          <td>${r.edited_at || ""}</td>
          <td>${r.ip || ""}</td>
          <td>${r.summary || ""}</td>
        </tr>`,
        )
        .join("\n");

  return wrapPage(`History: ${article.title}`, `
    <p><a href="${BASE_PATH}/wiki/${article.slug}/">Back to article</a></p>
    <table>
      <thead><tr><th>Revision</th><th>Date</th><th>Editor IP</th><th>Summary</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}

function generateRecentChangesPage(revisions) {
  const rows = revisions
    .map(
      (r) =>
        `<tr>
      <td><a href="${BASE_PATH}/wiki/${r.article}/">${r.articleTitle || r.article}</a></td>
      <td>${r.edited_at || r.id}</td>
      <td>${r.ip || ""}</td>
      <td>${r.summary || ""}</td>
    </tr>`,
    )
    .join("\n");

  return wrapPage("Recent Changes", `
    <table>
      <thead><tr><th>Article</th><th>Date</th><th>Editor IP</th><th>Summary</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}

// Run
await build();
