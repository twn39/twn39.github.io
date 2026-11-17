---
title: "Designing for AI Search & Coding Agents: Shipping llms.txt and Clean Markdown Endpoints"
description: "Why modern developer blogs must serve both human engineers and LLMs—and how tamp-llms-index cuts agent context token noise by 68%."
lang: "en"
translationSlug: "llms-txt-ai-search-indexing"
pubDate: 2026-11-10
updatedDate: 2026-11-17
project: "tamp-llms-index"
tags: ["llms.txt", "AI Search", "GEO", "Markdown"]
readingTime: 7
coverImage: "/images/blog/llms-txt-pipeline.svg"
coverAlt: "Build-time pipeline generating llms.txt, llms-full.txt, and per-post .md endpoints"
coverSpec: "FIG 04.A · LLMSTXT.ORG SPEC · -68% TOKENS"
featured: true
---

The readership of open-source documentation and engineering blogs has fundamentally expanded. Alongside human developers reading in browsers, retrieval crawlers and coding agents—**Claude Code, Cursor, Perplexity, ChatGPT Search**—continuously fetch your architecture notes to answer design questions and synthesize working code. Traditional `sitemap.xml` files and styled HTML documents filled with SVG icons and Shiki `<span>` wrappers are notoriously hostile to LLM context windows.

That gap led us to build **tamp-llms-index** and wire it directly into this site's static build.

![Three-Tier Build-Time AST to llms.txt and Markdown Endpoint Pipeline](/images/blog/llms-txt-pipeline.svg)

## Three Failure Modes of Raw HTML Ingestion

When an AI search indexer or coding agent fetches a rendered web page directly, three problems compound:

1. **68% Context Token Waste**: A 2,500-word essay balloons past `80 KB` (`~20,000 tokens`) once navigation chrome, inline SVGs, and per-token syntax-highlighting spans are serialized.
2. **Corrupted Tables & Code Fences**: Generic HTML-to-text strippers frequently flatten multi-column latency tables or drop language identifiers on fenced code blocks.
3. **Missing Semantic Topology**: Neither `robots.txt` nor `sitemap.xml` communicates *which repositories exist* or *which architecture essay explains which GitHub codebase*.

## Three-Tier AI-Native Indexing Architecture

Following the [llmstxt.org](https://llmstxt.org) specification, `tamp-llms-index` compiles three plain-text layers directly from typed Markdown ASTs at build time—100% compatible with static GitHub Pages hosting:

### 1. Concise Discovery Map (`/llms.txt`)

Kept compact (~`2,000 tokens`), `/llms.txt` organizes Open Source Repositories, Chinese Technical Essays, and English Technical Essays with one-line summaries, repository links, and direct `.md` URLs so an agent can map the entire lab in one request.

### 2. Per-Essay Zero-Noise Mirrors (`/blog/[slug].md`)

Appending `.md` to any essay URL (or clicking **Copy Markdown for LLM** in the article toolbar) serves crisp UTF-8 Markdown prefaced with canonical metadata and GitHub repository provenance:

```ts
// Build-time compiler emitting zero-noise Markdown per essay
export async function buildMarkdownEndpoint({ post, project }) {
  const header = [
    `# ${post.data.title}`,
    `> ${post.data.description}`,
    ``,
    `- Canonical URL: https://espresso-lab.github.io/en/blog/${post.data.translationSlug}/`,
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

### 3. Single-Fetch Full Corpus (`/llms-full.txt`)

Built for long-context reasoning models (200K–1M context windows), `/llms-full.txt` bundles every repository specification and bilingual technical essay into a single clean document ready for NotebookLM, Claude Projects, or local vector ingestion.

## Measured Token Efficiency

Across the four illustrated essays on this blog, measured token budgets show dramatic compression without losing a single character of technical substance:

| Ingestion Method | Avg Payload Size | Avg Context Tokens | Code & Benchmark Table Fidelity |
| :--- | :--- | :--- | :--- |
| Rendered HTML Fetch | 78.4 KB | ~19,800 tokens | Fair (polluted by UI controls & spans) |
| Readability Extraction | 21.6 KB | ~7,400 tokens | Good (occasionally drops fence langs) |
| **Native `/blog/[slug].md`** | **9.8 KB** | **~2,950 tokens** | **100% lossless source Markdown AST** |

Paired with explicit crawler directives in `/robots.txt` (`ClaudeBot`, `GPTBot`, `OAI-SearchBot`, `PerplexityBot`) and `<link rel="alternate" type="text/plain" href="/llms.txt">` discovery tags in `<head>`, a static GitHub blog becomes an immediately citable knowledge source for AI search engines.
