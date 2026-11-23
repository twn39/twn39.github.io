import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { formatClosedSourceProjectsMarkdown } from '../../lib/markdown';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://twn39.github.io';
  const posts = await getCollection('blog', (entry) => entry.data.lang === 'en');

  return new Response(formatClosedSourceProjectsMarkdown(origin, 'en', posts), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
