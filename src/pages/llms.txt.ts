import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CLOSED_SOURCE_PROJECTS, ESPRESSO_PROJECTS } from '../data/projects';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://twn39.github.io';
  const allPosts = await getCollection('blog');

  const zhPosts = allPosts
    .filter((p) => p.data.lang === 'zh')
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const enPosts = allPosts
    .filter((p) => p.data.lang === 'en')
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const lines: string[] = [
    `# BitesBytes Lab · 独立开发与技术分享 (@twn39 Indie Dev & Technical Blog)`,
    ``,
    `> High-performance C++/Python nanobind libraries (pylibheif, pyopenxlsx), C++17 OOXML document kernels (OpenXLSX-NX), Rust zero-copy math compilers (tex2math), cross-platform PySide6 desktop craft (yt-dlp-qt-gui), and AI Coding Agent static analysis tools (codegraph-gen) by Tang Weinan (https://github.com/twn39). Bilingual (zh-CN / en).`,
    ``,
    `This file conforms to the https://llmstxt.org specification to help AI search engines, RAG pipelines, and coding agents index our open-source GitHub repositories and technical essays with minimal token overhead.`,
    ``,
    `## Machine-Readable Endpoints`,
    ``,
    `- [Full Knowledge Corpus (llms-full.txt)](${origin}/llms-full.txt): Complete plain-text Markdown bundle of all repositories and bilingual technical essays in a single fetch.`,
    `- [Open Source Matrix Markdown](${origin}/en/projects.md): Clean Markdown specification of all open-source repositories (中文版: ${origin}/projects.md).`,
    `- [Closed-Source Apps Markdown](${origin}/en/closed-source.md): Clean Markdown overview of all Apple App Store applications (中文版: ${origin}/closed-source.md).`,
    `- [XML Sitemap](${origin}/sitemap-index.xml): Bilingual URL index with hreflang alternates and lastmod timestamps.`,
    `- [RSS 2.0 Feed](${origin}/rss.xml): Syndicated updates for new architecture essays.`,
    `- [Chinese Home](${origin}/): Default Chinese edition.`,
    `- [English Home](${origin}/en/): Complete English mirror edition.`,
    ``,
    `## Open Source GitHub Repositories`,
    ``,
    ...ESPRESSO_PROJECTS.map((proj) => {
      const linked = enPosts.filter((p) => p.data.project === proj.slug);
      const linkedNote =
        linked.length > 0
          ? ` | Linked Essays (.md): ${linked.map((p) => `${origin}/en/blog/${p.data.translationSlug}.md`).join(', ')}`
          : '';
      return `- [${proj.repo} (${proj.version}, ${proj.primaryLang}, ★ ${proj.stars})](${proj.repoUrl}): ${proj.i18n.en.tagline} — ${proj.i18n.zh.tagline}${linkedNote}`;
    }),
    ``,
    `## Closed-Source Apps — Apple App Store`,
    ``,
    ...CLOSED_SOURCE_PROJECTS.map((proj) => {
      const linked = enPosts.filter((p) => p.data.project === proj.slug);
      const linkedNote =
        linked.length > 0
          ? ` | Public Architecture Essays (.md): ${linked.map((p) => `${origin}/en/blog/${p.data.translationSlug}.md`).join(', ')}`
          : '';
      return `- [${proj.i18n.en.displayName} (${proj.version}, ${proj.deliveryModel})](${origin}/en/apps/${proj.slug}.md): ${proj.i18n.en.tagline} — ${proj.i18n.zh.tagline} | HTML: ${origin}/en/apps/${proj.slug}/ | App Store: ${proj.appStoreUrl.en}${linkedNote}`;
    }),
    ``,
    `## Technical Blog Essays — English (Clean Markdown Endpoints)`,
    ``,
    ...enPosts.map(
      (p) =>
        `- [${p.data.title}](${origin}/en/blog/${p.data.translationSlug}.md): ${p.data.description} (Project: ${p.data.project}, Published: ${p.data.pubDate.toISOString().slice(0, 10)}, HTML: ${origin}/en/blog/${p.data.translationSlug}/)`
    ),
    ``,
    `## 技术博客长文 — 简体中文 (纯净 Markdown 端点)`,
    ``,
    ...zhPosts.map(
      (p) =>
        `- [${p.data.title}](${origin}/blog/${p.data.translationSlug}.md): ${p.data.description} (关联项目: ${p.data.project}, 发布日期: ${p.data.pubDate.toISOString().slice(0, 10)}, 网页版: ${origin}/blog/${p.data.translationSlug}/)`
    ),
    ``,
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
