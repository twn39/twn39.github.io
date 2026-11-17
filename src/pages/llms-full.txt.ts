import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CLOSED_SOURCE_PROJECTS, ESPRESSO_PROJECTS } from '../data/projects';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://espresso-lab.github.io';
  const allPosts = (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const sections: string[] = [
    `# Espresso Engineering Lab — Full Technical Corpus (llms-full.txt)`,
    ``,
    `> Complete plain-Markdown compilation of all Espresso GitHub repositories and bilingual (zh-CN / EN) technical blog essays for LLM context windows, AI search indexing, and local RAG ingestion.`,
    ``,
    `- Canonical Index: ${origin}/llms.txt`,
    `- GitHub Organization: https://github.com/espresso-lab`,
    ``,
    `================================================================================`,
    `PART 1: OPEN SOURCE REPOSITORY SPECIFICATIONS`,
    `================================================================================`,
    ``,
  ];

  for (const proj of ESPRESSO_PROJECTS) {
    sections.push(
      `## Repository: ${proj.repo} (${proj.version})`,
      `- GitHub URL: ${proj.repoUrl}`,
      `- Primary Language: ${proj.primaryLang} | License: ${proj.license} | Stars: ${proj.stars}`,
      `- EN Summary: ${proj.i18n.en.tagline} — ${proj.i18n.en.summary}`,
      `- ZH Summary: ${proj.i18n.zh.tagline} — ${proj.i18n.zh.summary}`,
      `- Key Engineering Highlights:`,
      ...proj.i18n.en.highlights.map((h) => `  * ${h}`),
      ``
    );
  }

  sections.push(
    `================================================================================`,
    `PART 1B: CLOSED-SOURCE & PROPRIETARY SYSTEM SPECIFICATIONS`,
    `================================================================================`,
    ``
  );

  for (const proj of CLOSED_SOURCE_PROJECTS) {
    sections.push(
      `## Proprietary System: ${proj.name} (${proj.version} · ${proj.deliveryModel})`,
      `- Overview URL: ${origin}/en/closed-source/#${proj.slug}`,
      `- SLA / Scale: ${proj.slaMetric} | ${proj.scaleMetric}`,
      `- EN Summary: ${proj.i18n.en.tagline} — ${proj.i18n.en.summary}`,
      `- ZH Summary: ${proj.i18n.zh.tagline} — ${proj.i18n.zh.summary}`,
      `- Key Architecture Highlights:`,
      ...proj.i18n.en.highlights.map((h) => `  * ${h}`),
      ``
    );
  }

  sections.push(
    `================================================================================`,
    `PART 2: FULL TECHNICAL BLOG ESSAYS (ENGLISH & CHINESE)`,
    `================================================================================`,
    ``
  );

  for (const post of allPosts) {
    const htmlPath =
      post.data.lang === 'zh'
        ? `${origin}/blog/${post.data.translationSlug}/`
        : `${origin}/en/blog/${post.data.translationSlug}/`;

    sections.push(
      `---`,
      `# [${post.data.lang.toUpperCase()}] ${post.data.title}`,
      `- Description: ${post.data.description}`,
      `- Canonical URL: ${htmlPath}`,
      `- Related Project: ${post.data.project}`,
      `- Published: ${post.data.pubDate.toISOString().slice(0, 10)}`,
      `- Tags: ${post.data.tags.join(', ')}`,
      ``,
      post.body ?? '',
      ``
    );
  }

  return new Response(sections.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
