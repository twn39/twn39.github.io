import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeFigureCaption from './src/lib/rehype-figure-caption.mjs';

const SITE = 'https://twn39.github.io';

function collectBlogLastmod() {
  const map = new Map();
  const locales = [
    { dir: 'zh', prefix: '/blog' },
    { dir: 'en', prefix: '/en/blog' },
  ];

  for (const { dir, prefix } of locales) {
    const dirPath = path.resolve(`./src/content/blog/${dir}`);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(dirPath, file), 'utf-8');
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];
      const slug = fm.match(/^translationSlug:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim();
      const updated = fm.match(/^updatedDate:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim();
      const pub = fm.match(/^pubDate:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim();
      const dateStr = updated || pub;
      if (slug && dateStr) {
        const parsed = new Date(dateStr);
        if (!Number.isNaN(parsed.valueOf())) {
          map.set(`${SITE}${prefix}/${slug}/`, parsed.toISOString());
        }
      }
    }
  }
  return map;
}

const blogLastmod = collectBlogLastmod();

function readSiteLastmod() {
  try {
    const raw = fs.readFileSync(path.resolve('./src/data/github-profile.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed?.fetchedAt) return new Date(parsed.fetchedAt).toISOString();
  } catch {
    // ignore
  }
  return undefined;
}

const siteLastmod = readSiteLastmod();

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/404/') && !page.endsWith('/404.html'),
      i18n: {
        defaultLocale: 'zh',
        locales: {
          zh: 'zh-CN',
          en: 'en',
        },
      },
      serialize(item) {
        const postLastmod = blogLastmod.get(item.url);
        if (postLastmod) {
          item.lastmod = postLastmod;
        } else if (siteLastmod) {
          item.lastmod = siteLastmod;
        }
        return item;
      },
    }),
  ],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypeFigureCaption],
    shikiConfig: {
      themes: {
        light: 'github-light-default',
        dark: 'github-dark-default',
      },
      wrap: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  experimental: {
    parallelPrerender: true,
  },
});
