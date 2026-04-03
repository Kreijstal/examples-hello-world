---
title: "LLM-Assisted Reverse Engineering Frameworks"
slug: "llm-assisted-reverse-engineering-frameworks"
updated_at: "2026-04-03T00:00:00Z"
latest_revision: "2026-04-03T00-00-00Z"
---

There are already a few repositories in this space, but most fall into two adjacent buckets rather than the exact framework described here.

## Closest open projects

The closest open projects are:

- **LLM4Decompile**: an open-source model family for decompilation itself; its "Ref" path specifically refines Ghidra pseudocode, while its "End" path decompiles more directly from binary and ASM representations. ([GitHub][1])
- **Decyx**: a Ghidra extension focused on AI-assisted function and variable renaming, type inference, explanations, and caller-context analysis. ([GitHub][2])
- **GhidrAssist**: a Ghidra plugin with LLM tool-calling, autonomous navigation, renaming, xref navigation, and a semantic graph / Graph-RAG layer over indexed functions. ([GitHub][3])
- **OGhidra**: another Ghidra-based agentic workflow, with actions for renaming the current function and renaming all functions, plus an orchestrator / worker-agent architecture. ([GitHub][4])
- **ReVa** (`cyberkaida/reverse-engineering-assistant`): a Ghidra MCP server designed for long-form reverse engineering with many small tools; its examples explicitly include starting from `main`, renaming variables as it goes, and running headless for automation. ([GitHub][5])
- On the IDA and Binary Ninja side, there are similar MCP and assistant repositories such as **ida-pro-mcp**, **IDA RE Assistant**, **reverser_ai**, **BinAssist**, and **Binary Ninja MCP**. ([GitHub][6])

For the specific subproblem of naming stripped functions, there is also research code: **SymGen**, which implements the NDSS'25 work on inferring function names in stripped binaries using Ghidra plus a fine-tuned model. ([GitHub][7])

## What still looks differentiated

A differentiated design is the bottom-up dependency schedule described here: start with leaf functions, assign names, move to leaf-1, handle strongly connected components (SCCs) and recursion as a unit, and keep feeding improved names and types back into later passes.

No mature public repository was found that clearly advertises that exact pipeline as its core algorithm. Most current repositories are better described as LLM copilots for reverse engineering tools or LLM-guided decompiler refinement, not a principled call-graph-driven renaming framework. That is an inference from the repository descriptions above, not a claim that nobody has implemented it privately. ([GitHub][2])

## Gaps around correctness and binary plausibility

Code and data separation, wrong-binary detection, and instruction plausibility checks also appear to be real gaps. Ghidra's disassembly is based on recursive descent, and its own discussion notes they avoid always-on linear sweep because of embedded data issues; radare2's own documentation presents disassembly and analysis as heuristic tooling rather than a correctness-proof pipeline. ([GitHub][8])

There is research adjacent to this problem: **DisasLLM** proposes an LLM-based classifier to decide whether decoded instructions are correct in obfuscated executables, but no obvious public implementation repository was found in a quick search. ([arXiv][9])

## Summary

The answer is yes, repositories exist around this idea, but no public project was found that cleanly matches the full concept:

1. call-graph stratification from leaves upward,
2. SCC-aware joint naming for recursive clusters,
3. iterative retyping and renaming propagation,
4. plausibility scoring for whether bytes are really code,
5. binary, architecture, or compiler mismatch detection, and
6. an explicit self-correction loop over the disassembler and decompiler output. ([GitHub][2])

## Recommended architecture

A practical design would avoid making the LLM the first-pass oracle. A stronger architecture is:

- let Ghidra, radare2, Binary Ninja, or IDA produce the initial CFG, call graph, xrefs, and section hypotheses;
- compute SCCs and process the call graph in reverse topological order;
- ask the model for ranked candidate names plus confidence and rationale features rather than a single rename;
- validate names against imports, strings, constants, syscall or API neighborhoods, and callers and callees;
- re-run selective analysis after accepted renames and type updates; and
- maintain a suspect-region queue for likely code and data mistakes or impossible instruction streams.

That pattern fits well with the tool-driven MCP-style repositories above, but adds the deterministic scheduling layer they mostly lack. ([GitHub][3])

## Suggested starting stack

A good starting stack would be:

- **Ghidra** or **Binary Ninja** or **IDA** as the analysis substrate,
- an **MCP bridge** for tool access,
- a deterministic scheduler for SCC and bottom-up propagation, and
- a small evaluation corpus of stripped binaries with known symbols to measure rename precision and recall, and whether iterative passes improve downstream recovery.

Current repositories already show that the tool-bridge portion is feasible. ([GitHub][10])

[1]: https://github.com/albertan017/LLM4Decompile "GitHub - albertan017/LLM4Decompile: Reverse Engineering: Decompiling Binary Code with Large Language Models · GitHub"
[2]: https://github.com/philsajdak/decyx "GitHub - philsajdak/decyx: Decyx: AI-powered Ghidra extension for enhanced reverse engineering and binary analysis. · GitHub"
[3]: https://github.com/symgraph/GhidrAssist "GitHub - symgraph/GhidrAssist: An LLM extension for Ghidra to enable AI assistance in RE. · GitHub"
[4]: https://github.com/llnl/OGhidra "GitHub - llnl/OGhidra: OGhidra bridges Large Language Models (LLMs) via Ollama with the Ghidra reverse engineering platform, enabling AI-driven binary analysis through natural language. Interact with Ghidra using conversational queries and automate complex reverse engineering workflows. · GitHub"
[5]: https://github.com/cyberkaida/reverse-engineering-assistant "GitHub - cyberkaida/reverse-engineering-assistant: MCP server for reverse engineering tasks in Ghidra · GitHub"
[6]: https://github.com/mrexodia/ida-pro-mcp?utm_source=chatgpt.com "mrexodia/ida-pro-mcp: AI-powered reverse engineering ..."
[7]: https://github.com/OSUSecLab/SymGen "GitHub - OSUSecLab/SymGen: Implementation of \"Beyond Classification: Inferring Function Names in Stripped Binaries via Domain Adapted LLMs\" (NDSS'25) · GitHub"
[8]: https://github.com/NationalSecurityAgency/ghidra/discussions/2994?utm_source=chatgpt.com "What kind of disassembling technique does Ghidra use?"
[9]: https://arxiv.org/html/2407.08924v1?utm_source=chatgpt.com "Disassembling Obfuscated Executables with LLM"
[10]: https://github.com/bethington/ghidra-mcp?utm_source=chatgpt.com "bethington/ghidra-mcp: Production ..."
