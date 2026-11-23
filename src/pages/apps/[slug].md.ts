import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { CLOSED_SOURCE_PROJECTS, type EspressoClosedProject } from '../../data/projects';
import { formatAppLandingMarkdown } from '../../lib/markdown';

export const getStaticPaths: GetStaticPaths = async () => {
  return CLOSED_SOURCE_PROJECTS.map((app) => ({
    params: { slug: app.slug },
    props: { app },
  }));
};

export const GET: APIRoute = async ({ props, site }) => {
  const { app } = props as { app: EspressoClosedProject };
  const origin = site?.origin || 'https://twn39.github.io';
  const posts = await getCollection('blog', (entry) => entry.data.lang === 'zh');

  return new Response(formatAppLandingMarkdown(origin, 'zh', app, posts), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
