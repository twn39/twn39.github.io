---
title: "为编码 Agent 构建代码地图：codegraph-gen 的多语言 AST 聚类与无数据库图谱"
description: "为什么扁平关联的 Markdown 图谱库比图数据库更适合 Claude Code 与 Codex？详解 codegraph-gen 的 Louvain 社区发现与架构脆弱性检测。"
lang: "zh"
translationSlug: "codegraph-gen-agent-vault"
pubDate: 2026-10-30
updatedDate: 2026-11-14
project: "codegraph-gen"
tags: ["AI Agent", "tree-sitter", "Static Analysis", "Python"]
readingTime: 10
coverImage: "/images/blog/codegraph-gen-vault.svg"
coverAlt: "codegraph-gen 基于 tree-sitter 与模块度聚类的 Markdown 知识图谱生成管线"
coverSpec: "FIG 03 · 11-LANG AST GRAPH · ZERO DB VAULT"
featured: true
---

当 Claude Code、Codex 等编码 Agent 进入一个包含数千个源文件的大型多语言仓库时，最常见的瓶颈并非代码编写能力，而是**上下文迷航**：Agent 往往需要反复执行数十轮 `grep` 与文件盲读才能理清核心模块边界与隐式调用链，白白消耗大量上下文 Token 与推理延迟。

开源工具 **[twn39/codegraph-gen](https://github.com/twn39/codegraph-gen)** 从第一性原理出发，为本地编码 Agent 量身定制了一套**零外部数据库依赖、纯扁平 Markdown 双链组织（Obsidian-like Vault）的静态代码知识图谱编译器**。

![codegraph-gen 从多语言 tree-sitter AST 到关联 Markdown 图谱库的完整管线](/images/blog/codegraph-gen-vault.svg)

## 为什么摒弃 Neo4j / 向量库而选择扁平 Markdown Vault

许多早期代码图谱方案强依赖本地运行图数据库或重型 MCP 守护进程，这在实际研发流程中带来了高昂的配置门槛与同步滞后。而本地编码 Agent 最擅长、最原生的原语恰恰是**高速文件读取与相对路径跳转**：

1. **零基础设施启动**：无需 Docker，无需 Embedding API Key，一条命令即可在本地生成结构化图谱目录。
2. **原生双链与渐进式上下文展开**：生成的 `AGENTS.md` 充当全局入口导航图，每个逻辑组件（Component）与核心符号拥有独立的 `.md` 档案，Agent 只按需顺着相对链接下钻，上下文信噪比极高。

## 核心三阶段静态分析管线

### 1. 基于 `tree-sitter` 的 11 语言统一符号与语义边提取

`codegraph-gen` 并行调度 `tree-sitter` 语法树解析器，原生覆盖 **Python、TypeScript、JavaScript、Go、Rust、C、C++、Swift、Kotlin、Dart 与 OCaml**。通过构建高精度倒排符号索引，静态绑定三类关键有向边：

- `calls`：跨文件函数与方法调用解析；
- `inherits / implements`：类继承链与接口实现契约；
- `imports`：模块级依赖拓扑。

### 2. Louvain 模块度社区发现与自动组件命名

物理目录结构往往滞后于真实的业务耦合演化。我们在有向加权依赖图上运行 **贪心模块度社区发现算法（Louvain Modularity Clustering）**，自动将高内聚的文件与符号聚合为逻辑 **Component**，并依据社区内中心度最高的枢纽节点自动生成可读组件名。

```bash
# 对任意多语言仓库一键生成面向 AI Agent 的 Markdown 知识图谱与交互式拓扑图
uv tool install codegraph-gen
codegraph-gen analyze ./my-polyglot-repo --output ./.codegraph --visualize
```

### 3. 架构脆弱性静态诊断（God Nodes 与环路检测）

除了导航，图谱引擎还会直接向人类架构师与 AI Agent 暴露代码库的结构性坏味道：

- **God Nodes 识别**：计算入度/出度中心性，定位承担过多职责、修改爆炸半径最大的核心耦合点；
- **强连通分量（SCC）环路检测**：精确捕获文件级循环导入（Circular Imports）与跨模块函数相互递归环路，并同步输出可交互的浏览器端 Plotly 拓扑网络视图。
