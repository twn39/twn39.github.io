import type { APIRoute } from 'astro';
import { buildRssFeed } from '../../lib/rss';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://twn39.github.io';
  return buildRssFeed(origin, 'en');
};
