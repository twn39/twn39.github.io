import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://espresso-lab.github.io';
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const items = posts
    .map((p) => {
      const url =
        p.data.lang === 'zh'
          ? `${origin}/blog/${p.data.translationSlug}/`
          : `${origin}/en/blog/${p.data.translationSlug}/`;
      return [
        `    <item>`,
        `      <title>${escapeXml(p.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <description>${escapeXml(p.data.description)}</description>`,
        `      <pubDate>${p.data.pubDate.toUTCString()}</pubDate>`,
        `      <category>${escapeXml(p.data.project)}</category>`,
        `    </item>`,
      ].join('\n');
    })
    .join('\n');

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>Espresso Engineering Lab (浓缩工程志)</title>`,
    `    <link>${origin}/</link>`,
    `    <description>High-extraction systems architecture, open-source repositories &amp; technical essays.</description>`,
    `    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />`,
    items,
    `  </channel>`,
    `</rss>`,
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
