import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CLOSED_SOURCE_PROJECTS, ESPRESSO_PROJECTS } from '../data/projects';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://espresso-lab.github.io';
  const allPosts = await getCollection('blog');

  const zhPosts = allPosts
    .filter((p) => p.data.lang === 'zh')
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const enPosts = allPosts
    .filter((p) => p.data.lang === 'en')
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const lines: string[] = [
    `# Espresso Engineering Lab & Technical Blog (浓缩工程志)`,
    ``,
    `> High-extraction systems architecture, Rust/WebAssembly edge runtimes, LSM-Tree storage engines, eBPF continuous profiling, and AI-native documentation engineering. Bilingual (zh-CN / en).`,
    ``,
    `This file conforms to the https://llmstxt.org specification to help AI search engines, RAG pipelines, and coding agents index our open-source GitHub repositories and technical essays with minimal token overhead.`,
    ``,
    `## Machine-Readable Endpoints`,
    ``,
    `- [Full Knowledge Corpus (llms-full.txt)](${origin}/llms-full.txt): Complete plain-text Markdown bundle of all repositories and bilingual technical essays in a single fetch.`,
    `- [RSS 2.0 Feed](${origin}/rss.xml): Syndicated updates for new architecture essays.`,
    `- [Chinese Home](${origin}/): Default Chinese edition.`,
    `- [English Home](${origin}/en/): Complete English mirror edition.`,
    ``,
    `## Open Source GitHub Repositories`,
    ``,
    ...ESPRESSO_PROJECTS.map((proj) => {
      const linked = zhPosts.filter((p) => p.data.project === proj.slug);
      const linkedNote =
        linked.length > 0
          ? ` | Linked Essay (.md): ${origin}/en/blog/${linked[0].data.translationSlug}.md`
          : '';
      return `- [${proj.repo} (${proj.version}, ${proj.primaryLang}, ★ ${proj.stars})](${proj.repoUrl}): ${proj.i18n.en.tagline} — ${proj.i18n.zh.tagline}${linkedNote}`;
    }),
    ``,
    `## Closed-Source & Proprietary Systems`,
    ``,
    ...CLOSED_SOURCE_PROJECTS.map((proj) => {
      const linked = zhPosts.filter((p) => p.data.project === proj.slug);
      const linkedNote =
        linked.length > 0
          ? ` | Public Architecture Essay (.md): ${origin}/en/blog/${linked[0].data.translationSlug}.md`
          : '';
      return `- [${proj.name} (${proj.version}, ${proj.deliveryModel}, ${proj.slaMetric})](${origin}/en/closed-source/#${proj.slug}): ${proj.i18n.en.tagline} — ${proj.i18n.zh.tagline}${linkedNote}`;
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
