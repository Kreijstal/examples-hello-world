---
title: "About FreeWiki"
slug: "about"
updated_at: "2026-03-28T12:00:00Z"
latest_revision: "2026-03-28T12-00-00Z"
---

FreeWiki is a free, open wiki where anyone can edit any article.

## How it works

All article content is stored as Markdown files in a GitHub repository. The site is generated as static HTML and served via GitHub Pages. When someone edits an article, the change is committed directly to the repository through a Deno Deploy API server.

## Architecture

- **Storage**: GitHub repository (Markdown articles, TOON revision metadata)
- **Static hosting**: GitHub Pages
- **Write API**: Deno Deploy
- **Search**: Client-side JavaScript over a static index

## Editing

Click the "Edit" tab on any article to modify it. Edits are saved immediately. Every edit records the editor's IP address and a timestamp for moderation purposes.

## Moderation

FreeWiki uses reactive moderation. All edits are allowed by default. If vandalism occurs, edits can be reverted and the offending IP can be blocked.

## Revision history

Every edit creates a revision record. You can view the full history of any article by clicking the "History" tab. Reverting to a previous version is possible through the admin API.

## Technology

FreeWiki is built with:

- **Deno** for the server runtime and build tooling
- **GitHub API** for committing changes
- **MathML** for mathematical notation (native browser rendering)
- **TOON** (Token Oriented Object Notation) for structured data files
