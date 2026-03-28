---
title: "KGPC"
slug: "kgpc"
updated_at: "2026-03-28T21:00:00Z"
latest_revision: "2026-03-28T21-00-00Z"
---

{{infobox|title=KGPC|subtitle=Kreijstal Gwinn Pascal Compiler|type=Compiler|author=Kreijstal|date=Active development|website=https://github.com/Kreijstal/Pascal-Compiler}}

**KGPC** (Kreijstal Gwinn Pascal Compiler) is a Pascal compiler written in C that compiles Pascal source code to x86-64 assembly (Intel syntax). Its primary goal is to bootstrap the Free Pascal Compiler (FPC) without needing FPC itself or any proprietary compiler.

## Goal

The compiler aims to solve a bootstrapping problem: FPC is written in Pascal and needs an existing Pascal compiler to build itself. KGPC provides an independent C-based path to compile FPC from source, using FPC as the golden standard for compatibility.

Current bootstrap progress: FPC's main compiler source (`pp.pas`) compiles with 0 errors (down from 1,279), and 56 RTL units compile cleanly.

## Architecture

KGPC follows a classic multi-stage compiler design:

### Parser

Uses **cparser**, a custom parser combinator library written in C. It implements packrat parsing with memoization to handle left-recursion and generates an Abstract Syntax Tree (AST) via recursive descent.

### Semantic Analysis

Performs type checking, scope resolution, and symbol table management. Uses a unified **KgpcType** system as a first-class type representation with metadata. Handles overload resolution, forward declarations, and multi-level scope trees with unit import/export tracking.

### Optimizer

Implements multiple optimization passes through a pluggable pass manager:

- Dead Code Elimination (DCE)
- Constant Folding
- Unreferenced variable removal

### Code Generator

Generates x86-64 Intel syntax assembly targeting GCC/Clang for assembly and linking. Features a graph coloring register allocator, proper stack management, and System V AMD64 ABI compliance.

## Pascal Features Supported

### Core Language

- Program and unit structure
- Variables, constants, type definitions
- Functions and procedures (including nested)
- Control flow: if/then/else, while, repeat, for, case
- Exception handling

### Type System

- Primitives: integer, real, char, boolean, string, extended
- Pointers, arrays (1D and multi-dimensional), records
- Enumerations and set types
- Variant records
- Generic types/templates

### Object-Oriented

- Classes with inheritance
- Virtual and abstract methods
- Interfaces
- Properties (getters/setters)
- Class-of types (metaclass support)
- Advanced records (Delphi-style records with methods)
- Operator overloading

### Interoperability

- FFI with external C libraries (cdecl calling convention)
- Inline assembly blocks
- Compiler directives ({$ifdef}, {$mode}, {$include}, etc.)

## Runtime

KGPC includes a comprehensive FPC RTL compatibility layer in C, providing:

- String handling (AnsiString, ShortString, WideString)
- Dynamic array support
- File I/O operations
- Direct Linux syscalls (FPC_SYSCALL0-6)
- Math operations via GMP
- Thread support (cthreads unit)
- 20+ standard library unit stubs

## cparser

The parser combinator library is a notable component on its own. Written in C, it provides:

- Memoization-based packrat parsing
- Hash-table memo table for O(1) lookup
- Left-recursion handling
- Position tracking (line/column)
- Ambiguity resolution (first successful alternative)

## Testing

The project includes 935 test cases covering:

- Type system features (arrays, records, generics, type helpers)
- OOP features (classes, inheritance, virtual methods, interfaces)
- Operator overloading
- Built-in functions
- FPC compatibility edge cases

## Usage

```
# Build
meson setup build
meson compile -C build

# Compile Pascal to assembly
./build/kgpc input.p output.s

# Assemble and link
gcc -o output output.s

# Run
./output
```

Optimization flags: `-O1` (constant folding), `-O2` (remove unreferenced variables).

## Example Programs

The repository includes examples demonstrating:

- **months_complex.p** — enumerations, sets, records, const arrays, complex number types
- **umwandeln.p** — interactive console UI, buffer management, objects
- **http_server.pas** — network programming with C FFI, socket structures, syscalls

## See Also

- [User:kreijstal](/wiki/User:kreijstal/) — project author
- [Source code on GitHub](https://github.com/Kreijstal/Pascal-Compiler)
