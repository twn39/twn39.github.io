---
title: "面向 AI 搜索与编码 Agent 设计：工程化落地 llms.txt 与纯净 Markdown 端点"
description: "为什么未来的技术博客必须同时服务人类读者与大语言模型？详解 tamp-llms-index 如何降低 68% 的上下文 Token 噪音。"
lang: "zh"
translationSlug: "llms-txt-ai-search-indexing"
pubDate: 2026-11-10
updatedDate: 2026-11-17
project: "tamp-llms-index"
tags: ["llms.txt", "AI Search", "GEO", "Markdown"]
readingTime: 7
coverImage: "/images/blog/llms-txt-pipeline.svg"
coverAlt: "构建期自动生成 llms.txt、llms-full.txt 与单篇 .md 端点的流水线架构图"
coverSpec: "FIG 04.A · LLMSTXT.ORG SPEC · -68% TOKENS"
featured: true
---

今天，技术博客与开源文档的受众已经悄然改变：除了在浏览器中沉浸阅读的工程师，越来越多来自 **Claude Code、Cursor、Perplexity、ChatGPT Search** 的检索爬虫与编码 Agent 正在实时抓取你的架构文章，用来回答开发者的技术选型问题或辅助编写代码。然而，传统的 `sitemap.xml` 与充斥着 DOM 标签、SVG 图标和样式类名的 HTML 页面对大语言模型极不友好。

这正是我们开发 **tamp-llms-index** 并将其深度集成进本站的核心原因。

![构建期 AST 到 llms.txt 与单篇 Markdown 端点的三路输出架构](/images/blog/llms-txt-pipeline.svg)

## HTML 抓取给 LLM 带来的三大痛点

当 AI 搜索爬虫或本地 Agent 通过 `WebFetch` 直接拉取一个常规网页时，通常会遭遇以下损耗：

1. **严重的上下文预算浪费**：一段 2,500 字的技术长文，渲染成包含导航栏、内联 SVG、Shiki 行内 `<span style="...">` 高亮标签的 HTML 后，体积往往膨胀至 `90 KB+`（约 `24,000 Tokens`），其中超过 **68% 是非语义标记噪音**。
2. **表格与代码块结构退化**：通用 HTML-to-Text 提取器很容易弄乱多列基准测试表格或丢失代码块的语言标识。
3. **缺乏全站知识地图**：`robots.txt` 只声明「允许抓什么」，`sitemap.xml` 只罗列扁平 URL，二者都无法告诉 AI：「哪些仓库是核心开源项目？某篇技术博客对应哪个 GitHub 仓库？」

## 三层式 AI 原生索引架构

遵循 [llmstxt.org](https://llmstxt.org) 社区规范，`tamp-llms-index` 在每次静态构建时直接从文档抽象语法树（AST）编译生成三层纯文本接口（可直接部署于纯静态的 GitHub Pages）：

### 1. 轻量级导航清单 (`/llms.txt`)

控制在约 `2,000 Tokens` 以内的高密度入口清单，按「开源项目矩阵」、「中文技术长文」、「英文技术长文」结构化列出标题、一句话摘要、所属项目以及对应的 `.md` 纯净链接。Agent 只需一次轻量请求即可建立完整的站点心智模型。

### 2. 单篇零噪音镜像 (`/blog/[slug].md`)

在本站任意技术文章 URL 末尾直接加上 `.md`（或点击文章顶部的 **「复制全文 Markdown」** 按钮），即可获取包含标准化 YAML 元数据头（标题、发布日期、关联 GitHub 仓库、原文永久链接）与原始 Markdown 正文的纯净文本。

```ts
// 静态构建期端点示例：为每篇博客编译生成同路径 .md 纯文本文件
export async function buildMarkdownEndpoint({ post, project }) {
  const header = [
    `# ${post.data.title}`,
    `> ${post.data.description}`,
    ``,
    `- Canonical URL: https://espresso-lab.github.io/blog/${post.data.translationSlug}/`,
    `- Related GitHub Repo: ${project?.repoUrl ?? 'N/A'}`,
    `- Published: ${post.data.pubDate.toISOString().slice(0, 10)}`,
    `---`,
    ``,
  ].join('\n');

  return new Response(header + post.body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
```

### 3. 全量离线语料包 (`/llms-full.txt`)

针对支持长上下文窗口（200K–1M Tokens）的深度推理模型，`/llms-full.txt` 将所有开源仓库规格说明与中英双语技术长文一次性拼接为单文件知识库，方便开发者直接投喂给 NotebookLM、Claude Projects 或本地 RAG 向量库。

## 实测 Token 效率对比

我们对本站 4 篇深度技术长文进行了 tiktoken / Claude Tokenizer 实测对比：

| 抓取方式 | 单篇平均字节数 | 平均消耗 Tokens | 代码块与表格还原度 |
| :--- | :--- | :--- | :--- |
| 直接抓取渲染后 HTML | 78.4 KB | ~19,800 tokens | 一般（易混入行号与按钮文案） |
| Readability 正文抽取 | 21.6 KB | ~7,400 tokens | 良好（偶发丢失语言标记） |
| **原生 `/blog/[slug].md` 端点** | **9.8 KB** | **~2,950 tokens** | **100% 原始 AST 级无损保留** |

搭配显式放行 `ClaudeBot`、`GPTBot`、`OAI-SearchBot` 与 `PerplexityBot` 的 `/robots.txt` 以及 `<head>` 中的 `<link rel="alternate" type="text/plain" href="/llms.txt">` 声明，静态 GitHub Pages 博客也能成为一等公民级的 AI 知识节点。
