---
title: "Java Tools"
slug: "java-tools"
updated_at: "2026-03-28T22:30:00Z"
latest_revision: "2026-03-28T22-30-00Z"
---

{{infobox|title=Java Tools|subtitle=JVM Bytecode Analysis & Execution|type=Toolkit|author=Kreijstal|date=Active development|website=https://github.com/Kreijstal/java-tools}}

**Java Tools** is a comprehensive toolkit for Java bytecode analysis, manipulation, and execution, written in JavaScript. It includes a custom JVM implementation that runs in both Node.js and web browsers, a web-based visual debugger, dead code elimination passes, an LSP server for Jasmin assembly, and an MCP server for AI-assisted bytecode workflows. The project is licensed under AGPL-3.0.

## Architecture

### JVM Engine

The core is a complete JVM implementation (`jvm.js`) that executes Java bytecode directly in JavaScript. It features:

- **Class loader** with dynamic resolution and classpath support
- **Stack frame management** with local variables and operand stack
- **Multi-threading** via a Java thread model
- **Exception handling** with full try-catch-finally semantics
- **String interning** pool
- **JNI** (Java Native Interface) support
- **`invokedynamic`** cache for lambda/method reference support

The instruction set is split across modules by category: constants, loads, stores, math, conversions, stack manipulation, control flow, object operations, and method invocation.

### JRE Implementation

A JavaScript reimplementation of core Java Runtime Environment classes, mirroring the `java.*` package structure:

| Package | Classes |
|---------|---------|
| `java.lang` | Object, String, StringBuilder, Integer, Long, Double, Float, Boolean, Character, Math, System, Thread, Class, Enum, reflect.* |
| `java.io` | InputStream, OutputStream, PrintStream, BufferedReader, File, RandomAccessFile, DataInputStream |
| `java.util` | ArrayList, HashMap, HashSet, LinkedList, Arrays, Collections, Scanner, Stack, Properties, PriorityQueue |
| `java.net` | URL, Socket, HttpURLConnection, InetAddress, java.net.http (HttpClient, HttpRequest, HttpResponse) |
| `java.nio` | ByteBuffer, Charset |
| `java.awt` | Component, Container, Panel, Graphics, Color, BorderLayout, FlowLayout, Image, Scrollbar |
| `javax.sound` | AudioSystem, SourceDataLine, Mixer |

Also includes `com.ms.directX.DDSurfaceDesc` for legacy Microsoft DirectX Java interop.

### Class File Processing

The pipeline supports both directions:

1. **Parsing**: `.class` → AST via `jvm_parser`, then `convertJson()` for a workable tree
2. **Disassembly**: AST → Krakatau/Jasmin assembly text via `unparseDataStructures()`
3. **Assembly**: Jasmin `.j` source → AST via `parseKrak2Assembly()` + `convertKrak2AstToClassAst()`
4. **Emission**: AST → `.class` bytes via `writeClassAstToClassFile()`

## Analysis Passes

### Dead Code Elimination

A multi-stage optimizer built on a Control Flow Graph (CFG) representation:

1. **AST → CFG** conversion (`ast-to-cfg.js`)
2. **Dead code elimination** on the CFG (`deadCodeEliminator-cfg.js`)
3. **CFG → AST** reconstruction (`cfg-to-ast.js`)

The pass uses **purity analysis** to determine which method invocations have no side effects and can be safely removed. It also recalculates maximum stack heights after optimization.

### Constant Folding

Operates on the CFG, evaluating integer arithmetic (`iadd`, `isub`, `imul`, `idiv`, etc.) and comparison operations (`ifeq`, `if_icmplt`, etc.) at compile time when operands are known constants.

### Counter Loop Evaluation

Detects simple counted loops (e.g., `for (int i = 0; i < N; i++)`) and evaluates them at compile time when the loop body is pure, replacing the loop with its final state.

### Block Inlining

Merges basic blocks that have a single predecessor, reducing control flow graph complexity.

### Handler Relocation

Moves trivially misplaced exception handlers to their correct positions in the bytecode layout — a common issue in hand-written or generated Jasmin assembly.

### Purity Analysis

Classifies methods as pure (no side effects, no I/O, no field writes) to enable more aggressive dead code elimination and loop evaluation.

## Workspace and Refactoring

The `KrakatauWorkspace` provides a whole-program view over a classpath:

- **Symbol identification** and cross-referencing
- **Find references** across all loaded classes
- **Class renaming** — updates all references (class names, field types, method signatures, constant pool entries)
- **Method renaming** with descriptor matching
- **Field renaming** with reference tracking
- **Call graph construction** — who calls what, with caller metadata
- **Field reference metadata** — which methods read/write which fields
- **Method effects analysis** — determines whether methods are pure, throw exceptions, or have observable side effects

## Debugger

### Web Debugger

A browser-based visual debugger served via webpack:

- Step into / step over / step out / continue / rewind
- Breakpoint management
- Real-time inspection of operand stack, local variables, and call stack
- State serialization and restoration
- Class and method browser with dropdown selection
- Loads `.class` files and `.jar` archives via file upload or bundled `data.zip`

### TUI Debugger

A terminal-based debugger (`jvm-tui.js`) using `blessed` for a full-screen interface with class tree navigation and method inspection.

### Debug Controller

The `DebugController` wraps the JVM engine, providing programmatic control:

```javascript
const controller = new DebugController();
await controller.start('Hello.class');
await controller.stepInto();
const state = controller.getCurrentState();
// { pc, method, stack, locals, callStackDepth }
```

## Tooling

### Unified CLI (`jvm-cli.js`)

```
jvm-cli.js assemble <file.j>           # Jasmin → .class
jvm-cli.js disassemble <file.class>     # .class → Jasmin
jvm-cli.js lint [--fix] <file.j>        # Diagnostics + auto-fix
jvm-cli.js optimize <file.j>            # Dead code elimination
jvm-cli.js rename-class <file> --from X --to Y
jvm-cli.js rename-method <file> --class C --from m --to n
jvm-cli.js format <file.j>              # Canonical formatting
```

All mutating operations support `--dry-run` to preview diffs.

### LSP Server

A Language Server Protocol implementation for Jasmin assembly files (`JasminLspServer.js`), providing diagnostics (dead code, misplaced handlers) and code actions to IDE editors.

### MCP Server

A Model Context Protocol server (`mcp-server.js`) exposing bytecode analysis tools via JSON-RPC for AI-assisted workflows — assemble, disassemble, optimize, rename, and inspect class files through LLM tool use.

## Browser Integration

### AWT Support

Java AWT components render to HTML5 Canvas in the browser:

- `Component`, `Container`, `Panel` hierarchy
- `Graphics` context mapped to Canvas 2D API
- `BorderLayout`, `FlowLayout` layout managers
- Browser DOM events translated to AWT `Event` objects
- `Image` loading via browser fetch
- `Scrollbar` with adjustment events

### Build Pipeline

Webpack bundles the JVM, JRE stubs, and debugger UI into a browser-deployable package. A site builder (`buildSite.js`) generates the static web interface with example class files.

## Testing

- **Unit tests** via a custom runner (`run-tests.js`) covering arithmetic, object operations, exceptions, threading
- **Playwright tests** for the web debugger UI — debug interface, stepping, class selection, console errors, data zip loading
- **CI** via GitHub Actions with Node.js 18.x/20.x and Java 11/17

## See Also

- [User:kreijstal](/wiki/User:kreijstal/) — project author
- [Source code on GitHub](https://github.com/Kreijstal/java-tools)
