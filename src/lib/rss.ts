import fs from 'node:fs';
import path from 'node:path';
import { getCollection } from 'astro:content';
import type { Lang } from '../i18n/ui';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPublicFileSize(relPath: string): number | undefined {
  try {
    const clean = relPath.replace(/^\/+/, '');
    const full = path.resolve('./public', clean);
    if (fs.existsSync(full)) return fs.statSync(full).size;
  } catch {
    // ignore
  }
  return undefined;
}

export async function buildRssFeed(origin: string, lang: Lang): Promise<Response> {
  const posts = (await getCollection('blog', (entry) => entry.data.lang === lang)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const feedPath = lang === 'zh' ? '/rss.xml' : '/en/rss.xml';
  const homePath = lang === 'zh' ? '/' : '/en/';
  const title =
    lang === 'zh'
      ? 'BitesBytes Lab · 独立开发与技术分享'
      : 'BitesBytes Lab · Indie Dev & Technical Essays';
  const description =
    lang === 'zh'
      ? '聚焦独立开发、开源底层库、原生应用架构与一线工程实践。'
      : 'Focused on indie development, open-source libraries, native apps, and hands-on engineering essays.';

  const items = posts
    .map((p) => {
      const url =
        lang === 'zh'
          ? `${origin}/blog/${p.data.translationSlug}/`
          : `${origin}/en/blog/${p.data.translationSlug}/`;
      const coverUrl = new URL(p.data.coverImage, origin).toString();
      const coverBytes = getPublicFileSize(p.data.coverImage);

      return [
        `    <item>`,
        `      <title>${escapeXml(p.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <description>${escapeXml(p.data.description)}</description>`,
        `      <pubDate>${p.data.pubDate.toUTCString()}</pubDate>`,
        `      <category>${escapeXml(p.data.project)}</category>`,
        ...(coverBytes
          ? [`      <enclosure url="${escapeXml(coverUrl)}" length="${coverBytes}" type="image/png" />`]
          : []),
        `    </item>`,
      ].join('\n');
    })
    .join('\n');

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${origin}${homePath}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <language>${lang === 'zh' ? 'zh-CN' : 'en'}</language>`,
    `    <atom:link href="${origin}${feedPath}" rel="self" type="application/rss+xml" />`,
    items,
    `  </channel>`,
    `</rss>`,
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
