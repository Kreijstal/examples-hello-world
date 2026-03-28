# Free Wiki v1 Plan

## Goal

A simple Wikipedia-like wiki where:

- Anyone can edit any article anonymously
- Article content is stored in a GitHub repo (Markdown files)
- No traditional database — GitHub is the source of truth
- Deno Deploy handles writes and admin actions only
- GitHub Pages serves static reads
- Abuse is handled reactively: revert + IP block

## Architecture

```
READS (most traffic):
  browser -> GitHub Pages (static HTML/JSON/JS)

WRITES (rare):
  browser -> Deno Deploy API -> GitHub API -> repo commit

FRESHNESS CHECK:
  browser -> loads static page
          -> fetches GET /api/freshness (cached, from Deno)
          -> if article is dirty, fetches live content from Deno
```

## Repo Structure

```
/articles/
  physics/
    quantum-entanglement.md
  history/
    roman-empire.md

/revisions/
  quantum-entanglement/
    2026-03-28T18-42-11Z.toon
  roman-empire/
    2026-03-28T19-01-55Z.toon

/blocks/
  203.0.113.42.toon

/meta/
  recent-changes.json
  search-index.json
```

## Data Formats

### Article (`/articles/<category>/<slug>.md`)

```markdown
---
id: "quantum-entanglement"
title: "Quantum entanglement"
slug: "quantum-entanglement"
updated_at: "2026-03-28T18:42:11Z"
latest_revision: "2026-03-28T18-42-11Z"
---

Article body here...
```

### Revision (`/revisions/<slug>/<timestamp>.toon`)

```
article: quantum-entanglement
edited_at: "2026-03-28T18:42:11Z"
ip: 203.0.113.42
summary: fixed typo
previous_revision: 2026-03-28T18-20-03Z
content_hash: abc123
```

### Block (`/blocks/<ip>.toon`)

```
ip: 203.0.113.42
blocked_at: "2026-03-28T19:00:00Z"
reason: vandalism
```

Data files use [TOON (Token Oriented Object Notation)](https://toonformat.dev/) — a compact, human-readable format.

## Deno API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/edit/:slug` | Submit an article edit. Commits article + revision to GitHub. |
| `POST` | `/api/revert/:slug/:revision` | Revert article to a previous revision. |
| `POST` | `/api/block-ip` | Add IP to blocklist. |
| `GET`  | `/api/freshness` | Returns map of recently-edited article slugs + revision IDs. Cached. |
| `GET`  | `/api/article/:slug` | Returns latest article content (for fresh edits not yet in static build). |

### Edit Flow

1. Browser sends `POST /api/edit/:slug` with new content
2. Deno reads client IP
3. Deno checks IP against blocklist (reads `/blocks/<ip>.json` from GitHub)
4. Deno commits updated article file via GitHub Contents API
5. Deno commits revision metadata file
6. Static site rebuilds via GitHub Actions

### Freshness Flow

1. Static page loads with embedded `static-revision` meta tag
2. Browser fetches `GET /api/freshness` (short-cached, e.g. 15s max-age)
3. Response: `{ "articles": { "slug": "revision-id", ... } }`
4. If current page's slug has a newer revision, browser fetches `/api/article/:slug`
5. Replaces article content in DOM

## Static Site

Generated at build time from repo contents:

- `/wiki/<slug>/index.html` — article pages
- `/index.html` — home/index page
- `/recent-changes/index.html` — recent edits
- `/search-index.json` — lightweight JSON for client-side search
- `/titles.json` — article title list

### Search

Client-side JS over a static JSON index. No Deno needed.

```json
[
  { "slug": "quantum-entanglement", "title": "Quantum entanglement" },
  { "slug": "roman-empire", "title": "Roman Empire" }
]
```

## Moderation

- **Policy**: open editing by default, reactive moderation
- **IP logging**: every edit stores IP + timestamp in revision metadata (public in repo)
- **Abuse response**: block IP, revert bad edits
- **Revert**: creates a new revision pointing to the restored content
- Vandalism is a problem when it's a problem — don't overengineer before there are users

## GitHub API Integration

Deno writes to the repo via the GitHub Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`).

- Auth: personal access token stored as Deno Deploy env var `GITHUB_TOKEN`
- Creating a file: omit `sha` field
- Updating a file: include current `sha` (fetched via GET first)
- Content is base64-encoded

## Build Order

### Phase 1 — Content Model
- Define article, revision, and block formats
- Create initial repo structure
- Seed a few example articles

### Phase 2 — Static Site
- Build script to generate HTML from Markdown articles
- Generate index, recent-changes, search-index
- Deploy to GitHub Pages

### Phase 3 — Deno Write API
- `POST /api/edit/:slug`
- `POST /api/revert/:slug/:revision`
- `POST /api/block-ip`
- `GET /api/freshness`
- `GET /api/article/:slug`

### Phase 4 — Edit UI
- Edit button + form on article pages
- Submit to Deno API
- Show success/error

### Phase 5 — Admin/Moderation
- Recent changes page
- Revision history per article
- Revert button
- Block IP interface

## Constraints Accepted

- IPs are public in the repo (deliberate choice)
- Repo history will grow with every edit
- Edits may briefly appear stale until GitHub Pages rebuilds
- Concurrent edits may conflict (acceptable at low traffic)
- No accounts, no auth beyond IP
- GitHub API rate limits apply (5000/hr with token)

## Tech Stack

- **Storage**: GitHub repo (Markdown + JSON files)
- **Static hosting**: GitHub Pages
- **Dynamic API**: Deno Deploy
- **Build**: Deno script (Markdown -> HTML)
- **Search**: Client-side JS
- **CI**: GitHub Actions (rebuild on push)
