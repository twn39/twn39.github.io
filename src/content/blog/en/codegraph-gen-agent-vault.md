---
title: "Mapping Codebases for Coding Agents: Polyglot AST Clustering in codegraph-gen"
description: "Why flat Obsidian-style Markdown vaults beat heavy graph databases for Claude Code and Codex—inside codegraph-gen's tree-sitter and Louvain pipeline."
lang: "en"
translationSlug: "codegraph-gen-agent-vault"
pubDate: 2026-10-30
updatedDate: 2026-11-14
project: "codegraph-gen"
tags: ["AI Agent", "tree-sitter", "Static Analysis", "Python"]
readingTime: 10
coverImage: "/images/blog/codegraph-gen-vault.svg"
coverAlt: "codegraph-gen tree-sitter AST to Louvain-clustered Markdown agent vault diagram"
coverSpec: "FIG 03 · 11-LANG AST GRAPH · ZERO DB VAULT"
featured: true
---

When coding agents like Claude Code or Codex drop into an unfamiliar polyglot repository with thousands of files, their biggest bottleneck is rarely code synthesis—it is **architectural orientation**. Agents routinely burn dozens of grep-and-read tool turns reconstructing call hierarchies and hidden coupling, wasting context tokens and latency.

**[twn39/codegraph-gen](https://github.com/twn39/codegraph-gen)** compiles any multi-language codebase into a **database-free, interconnected Markdown knowledge graph (Obsidian-compatible vault)** purpose-built for local AI agents.

![codegraph-gen Polyglot tree-sitter AST to Agent Markdown Vault Pipeline](/images/blog/codegraph-gen-vault.svg)

## Why Flat Markdown Vaults Outperform Graph Databases for Agents

Requiring developers to spin up Neo4j containers, vector stores, or background daemons creates friction and stale indexes. Local coding agents already excel at two native primitives: **fast file reads and relative link traversal**.

1. **Zero Infrastructure**: No Docker daemons, no embedding API keys, and zero token cost during graph compilation.
2. **Progressive Context Disclosure**: Generated `AGENTS.md` files act as topological entry maps, linking to per-component Markdown notes so agents pull strictly the subgraph relevant to the task.

## Three-Stage Static Analysis Architecture

### 1. 11-Language `tree-sitter` Semantic Edge Binding

`codegraph-gen` runs parallel `tree-sitter` parsers backed by a nanosecond Stat-First incremental cache across **Python, TypeScript, JavaScript, Go, Rust, C, C++, Swift, Kotlin, Dart, and OCaml**, resolving three directed edge types via an inverted symbol index:

- `calls`: Cross-file function and method invocations;
- `inherits / implements`: Subtyping and trait/interface realization;
- `imports`: Module-level dependency edges.

### 2. Louvain Modularity Component Clustering

Directory trees frequently drift from actual architectural coupling. Applying **Louvain modularity clustering** over the weighted symbol graph groups tightly coupled files into cohesive logical **Components**, automatically naming each cluster after its highest-centrality hub symbols.

```bash
# Compile an AI-ready Markdown knowledge vault + interactive Plotly dependency topology
uv tool install codegraph-gen
codegraph-gen analyze ./my-polyglot-repo --output ./.codegraph --visualize
```

### 3. Architectural Fragility Diagnostics

Alongside navigation notes, `codegraph-gen` flags structural risks automatically:

- **God-Node Detection**: Ranks symbols with disproportionate fan-in/fan-out blast radius;
- **Circular Dependency & Cycle Detection**: Pinpoints file-level circular imports and cross-module mutual recursion cycles, paired with an interactive browser-based Plotly network explorer.
