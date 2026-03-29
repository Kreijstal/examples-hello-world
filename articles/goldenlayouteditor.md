---
title: "GoldenLayout Editor"
slug: "goldenlayouteditor"
updated_at: "2026-03-29T00:00:00Z"
latest_revision: "2026-03-29T00-00-00Z"
---

{{infobox|title=GoldenLayout Editor|subtitle=Browser-based Code Editor & Preview|type=Web Application|author=Kreijstal|date=Active development|website=https://github.com/Kreijstal/goldenlayouteditor}}

**GoldenLayout Editor** is an offline-first, browser-based code editor built on [GoldenLayout](https://golden-layout.com/) for panel management and [Ace Editor](https://ace.c9.io/) for code editing. It features live preview for web files, Typst document compilation via WebAssembly, a Pandoc format converter loaded from WASM, an integrated terminal via xterm.js with server-side PTY sessions, and a plugin system for extensibility. The project is licensed under AGPL-3.0.

## Architecture

The application has two modes:

- **Offline/static mode**: The editor, preview, and Typst compiler run entirely in the browser. A Service Worker intercepts preview requests and serves files from an in-memory map. The terminal falls back to a JavaScript REPL.
- **Server-enhanced mode**: An Express + WebSocket server provides filesystem access, workspace loading, PTY terminal sessions, in-memory preview file serving, and debug log forwarding.

```
Browser
├── GoldenLayout (panel management, drag-and-drop, tabs)
├── Ace Editor (syntax highlighting, code completion)
├── Preview (iframe with Service Worker or server-backed rendering)
├── Typst (WASM compiler from esm.sh, SVG output)
├── Pandoc (WASM converter from unpkg, ~55MB binary)
├── Terminal (xterm.js from esm.sh, PTY or JS REPL)
└── Service Worker (offline preview serving)
         │
         │ WebSocket (optional)
         ▼
Server (Express + WS)
├── Static file serving
├── In-memory preview files
├── Workspace filesystem access
├── PTY shell sessions (node-pty)
└── Client debug log forwarding
```

## Panel Components

### Editor

Each open file gets an Ace Editor instance with:

- Syntax highlighting (HTML, CSS, JavaScript, JSON, Typst via custom mode)
- Autocompletion and snippets
- Cursor and selection state persistence across sessions
- Dirty-file tracking

### Preview

The preview panel renders the current project as a web page in an iframe. Supports multiple file type handlers:

| File Type | Preview Method |
|-----------|---------------|
| HTML/CSS/JS | Composed into iframe with injected `<link>` and `<script>` tags |
| Typst (`.typ`) | WASM compilation → SVG rendering with zoom/pan |
| JSON | Syntax-highlighted display |
| Markdown | Rendered with KaTeX math support |
| PDF | Browser's native PDF viewer |
| Images | `<img>` with zoom/pan controls |
| Video/Audio | Native `<video>`/`<audio>` elements |
| Binary | Hex viewer (first 64KB) |

### File Browser

A tree view of project files with:

- Directory expand/collapse
- File icons by type
- Context menus (rename, delete, convert with Pandoc)
- Active file highlighting
- Workspace directory browsing (server mode)

### Terminal

An xterm.js terminal loaded dynamically from esm.sh:

- In server mode: real PTY sessions via `node-pty`, with resize handling and session cleanup
- In offline mode: JavaScript REPL with `eval()`
- Supports image rendering via xterm Image addon
- Ctrl+key combos forwarded to terminal (except Ctrl+Shift+I/J for dev tools)

## Plugin System

Plugins register via a central registry and can provide:

- **GoldenLayout components** — custom panel types
- **Toolbar buttons** — added to the file browser toolbar
- **Context menu items** — file-specific actions
- **Default files** — starter content for new projects
- **Init hooks** — called with app context after layout loads

### Built-in Plugins

**Terminal** — Registers the terminal panel component and toolbar button. Injects the WebSocket client into the component class for PTY communication.

**Typst** — Registers a file handler for `.typ` files and provides a default `main.typ`. The handler lazily loads `@myriaddreamin/typst.ts` WASM compiler from esm.sh, compiles Typst source to SVG, and renders with zoom controls and diagnostics display. Includes a custom Ace mode for Typst syntax highlighting.

**Pandoc** — Provides a format converter panel using `pandoc-wasm` (~55MB WASM binary loaded from unpkg). Supports conversion between Markdown, LaTeX, Typst, reStructuredText, Org Mode, HTML, and plain text. Options include standalone output and table of contents generation. Converted output can be saved as a new project file.

## WebSocket Protocol

The client and server communicate via JSON messages over WebSocket:

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `serverConfig` | Server → Client | Send debug mode flag on connect |
| `updateFiles` | Client → Server | Push preview files to server memory |
| `listDir` | Client → Server | Browse filesystem directories |
| `openWorkspace` | Client → Server | Load entire directory tree recursively |
| `saveFile` | Client → Server | Write file to disk (path traversal protected) |
| `readFile` | Client → Server | Read file content from workspace |
| `mkdir` | Client → Server | Create directory |
| `termSpawn` | Client → Server | Start PTY session |
| `termInput` | Client → Server | Send keystrokes to PTY |
| `termData` | Server → Client | PTY output data |
| `termResize` | Client → Server | Resize PTY dimensions |
| `fsChanges` | Server → Client | Filesystem watcher notifications (debounced 300ms) |
| `clientLog` | Client → Server | Forward browser console logs |

All request/response pairs use an `id` field for correlation.

## Session Persistence

Editor state is saved to `localStorage` with debouncing:

- GoldenLayout configuration (panel positions, sizes)
- Workspace path
- Open tabs mapped by file path
- Cursor positions and selections per file

On page reload, the user is prompted to restore the previous session or start fresh. Restored sessions re-open the workspace via WebSocket and remap file IDs.

## External Dependencies

Heavy dependencies are loaded at runtime from CDNs to keep the browserify bundle small:

- **xterm.js** v5.5.0 from esm.sh
- **typst.ts** v0.6.1-rc5 from esm.sh
- **pandoc-wasm** v1.0.1 from esm.sh + unpkg

## See Also

- [User:kreijstal](/wiki/User:kreijstal/) — project author
- [Source code on GitHub](https://github.com/Kreijstal/goldenlayouteditor)
