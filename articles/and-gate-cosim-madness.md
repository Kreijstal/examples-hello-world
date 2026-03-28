---
title: "AND Gate Cosimulation Madness"
slug: "and-gate-cosim-madness"
updated_at: "2026-03-28T22:00:00Z"
latest_revision: "2026-03-28T22-00-00Z"
---

{{infobox|title=AND Gate Cosimulation Madness|subtitle=The "Hello World" of Hardware|type=Workshop / Educational|author=Kreijstal|date=Active|website=https://github.com/Kreijstal/AND-gate-cosim-madness}}

**AND Gate Cosimulation Madness** is an educational project that demonstrates every conceivable way to simulate a single AND gate using open-source EDA tools. It serves as a practical workshop for learning hardware/software cosimulation by exhaustively combining HDL simulators, languages, and interface standards (VPI, DPI-C, VHPIDIRECT, CXXRTL).

## Motivation

The project treats the AND gate as the "Hello World" of digital design. By keeping the design under test trivially simple, the focus shifts entirely to the *tooling and interfaces* — how different simulators, languages, and foreign-function mechanisms connect and interoperate.

The key insight: cosimulation infrastructure is hard to learn because real designs obscure the plumbing. With a one-line `assign y = a & b`, all complexity is in the build system and interface code.

## The AND Gate

Every variant simulates the same logic, defined in Verilog as:

```verilog
module and_gate (
    input wire a,
    input wire b,
    output wire y
);
    assign y = a & b;
endmodule
```

Equivalent implementations exist in VHDL (IEEE STD_LOGIC), Python (MyHDL, Amaranth), and C.

## Simulation Variants

The repository contains 22 distinct simulation setups, organized by approach:

### Pure HDL Simulation

| Directory | Description |
|-----------|-------------|
| `iverilog_pure` | Icarus Verilog with standard Verilog testbench |
| `ghdl_IEEE` | GHDL with pure VHDL testbench (IEEE STD_LOGIC) |
| `verilator` | Verilator with auto-generated C++ testbench |
| `verilator_manualtb` | Verilator with hand-written C++ testbench |

### VPI (Verilog Procedural Interface)

VPI allows C/C++ code to interact with a Verilog simulation at runtime, registering system functions callable from Verilog.

| Directory | Description |
|-----------|-------------|
| `iverilog_vpitb` | Icarus Verilog with C testbench via VPI |
| `vpi_iverilogtb` | C VPI module driving Icarus Verilog AND gate |
| `vpi_verilatortb` | C++ VPI module driving Verilator AND gate |
| `verilator_impl_iverilogtb` | Verilator DUT exposed to Icarus Verilog TB via VPI — the Verilator model runs inside the Icarus process |

### DPI-C (Direct Programming Interface)

DPI-C provides a cleaner, SystemVerilog-standard way to call C/C++ functions from HDL without VPI boilerplate.

| Directory | Description |
|-----------|-------------|
| `dpi-c_verilator` | Verilator with DPI-C imported C++ AND gate |
| `dpi-c_verilatortb` | Verilator testbench calling DPI-C functions |

### CXXRTL (Yosys C++ Backend)

CXXRTL is Yosys's lightweight cycle-based simulation backend that compiles Verilog to a C++ class.

| Directory | Description |
|-----------|-------------|
| `cxxrtl` | Pure CXXRTL simulation via Yosys |
| `cxxrtl_impl_iverilogtb` | CXXRTL model called from Icarus Verilog testbench via VPI |
| `cxxrtl_impl_verilatortb` | CXXRTL DUT checked against Verilator reference model |
| `verilator_impl_cxxrtltb` | Verilator DUT checked against CXXRTL reference model |

### GHDL + C / Cross-Simulator

GHDL supports VHPIDIRECT, allowing VHDL to call C functions directly. Combined with Verilator's DPI-C, this enables VHDL↔C↔SystemVerilog chains.

| Directory | Description |
|-----------|-------------|
| `ghdl_c_IEEE` | GHDL calling a C implementation of AND via VHPIDIRECT |
| `ghdl_verilator_driver` | Full chain: VHDL (GHDL) → C (VHPIDIRECT) → SystemVerilog proxy (DPI-C) → Verilator testbench |
| `verilator_ghdltb` | Verilator DUT driven from GHDL VHDL testbench |

### Python-Based

| Directory | Description |
|-----------|-------------|
| `myhdl` | MyHDL cosimulation — Python AND gate vs. Verilog AND gate via Icarus VPI |
| `amaranth_sim` | Amaranth pure Python simulator |
| `amaranth_cocotb` | Amaranth design tested with Cocotb framework |
| `amaranth_extsim` | Amaranth with external simulator backend hooks |

### Synthesis

| Directory | Description |
|-----------|-------------|
| `xilinx_synth` | Yosys synthesis targeting Xilinx (synth_xilinx) |
| `xilinx_synth_sim` | Post-synthesis simulation of Xilinx netlist via Icarus Verilog |

## Notable Cross-Simulator Combinations

### Verilator inside Icarus Verilog (verilator_impl_iverilogtb)

A Verilator-compiled AND gate is wrapped in a VPI shared library and loaded into Icarus Verilog. The Icarus testbench calls `$verilator_and_gate(a, b)` as a system function, which internally sets inputs on the Verilator model, calls `eval()`, and returns the result. This demonstrates using a fast compiled model as an oracle inside an interpreted simulation.

### GHDL → C → Verilator (ghdl_verilator_driver)

A three-language chain: the VHDL entity calls a C function (`and_gate_c`) via GHDL's VHPIDIRECT. The C function is compiled into a static library. A SystemVerilog proxy module imports the same C function via DPI-C. Verilator compiles the proxy and links against both the C library and GHDL's VPI runtime. The result: a VHDL-described AND gate executing through C, driven by a Verilator C++ testbench.

### CXXRTL vs. Verilator Cross-Check

Two variants (`cxxrtl_impl_verilatortb` and `verilator_impl_cxxrtltb`) run the same test vectors through both simulation backends and compare results, verifying that independent compilation paths produce identical behavior.

## Interface Standards Used

| Standard | Purpose | Used By |
|----------|---------|---------|
| **VPI** (IEEE 1364) | Runtime C interface to Verilog simulation | Icarus Verilog, Verilator |
| **DPI-C** (IEEE 1800) | Direct C function import/export in SystemVerilog | Verilator |
| **VHPIDIRECT** (IEEE 1076) | Direct C function binding in VHDL | GHDL |
| **CXXRTL** | Yosys C++ simulation backend | Yosys |
| **Cocotb** | Python coroutine-based testbench framework | GPI (simulator-agnostic) |

## Tools

All tools used are open-source:

- **Icarus Verilog** — Verilog simulator
- **Verilator** — Verilog-to-C++ compiler (cycle-accurate)
- **GHDL** — VHDL simulator (LLVM/GCC/mcode backends)
- **Yosys** — Synthesis framework (provides CXXRTL backend)
- **MyHDL** — Python HDL library with cosimulation via VPI
- **Amaranth** — Python HDL framework (formerly nMigen)
- **Cocotb** — Python testbench framework

## Usage

```
git clone https://github.com/Kreijstal/AND-gate-cosim-madness.git
cd AND-gate-cosim-madness

# Run a specific variant
make run_iverilog_pure
make run_verilator_manualtb
make run_ghdl_verilator_driver

# Run everything
make run

# Clean
make clean
```

Each subdirectory has its own Makefile with the full build recipe.

## See Also

- [User:kreijstal](/wiki/User:kreijstal/) — project author
- [Source code on GitHub](https://github.com/Kreijstal/AND-gate-cosim-madness)
