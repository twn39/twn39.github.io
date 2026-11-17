import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { resolveProjectMeta } from '../../../data/projects';

export const getStaticPaths: GetStaticPaths = async () => {
  const enPosts = await getCollection('blog', (entry) => entry.data.lang === 'en');
  return enPosts.map((post) => ({
    params: { slug: post.data.translationSlug },
    props: { post },
  }));
};

export const GET: APIRoute = async ({ props, site }) => {
  const { post } = props as { post: CollectionEntry<'blog'> };
  const project = resolveProjectMeta(post.data.project, 'en');
  const origin = site?.origin || 'https://espresso-lab.github.io';

  const markdown = [
    `# ${post.data.title}`,
    ``,
    `> ${post.data.description}`,
    ``,
    `- Language: en (中文版本: ${origin}/blog/${post.data.translationSlug}.md)`,
    `- Canonical URL: ${origin}/en/blog/${post.data.translationSlug}/`,
    `- Published: ${post.data.pubDate.toISOString().slice(0, 10)}`,
    `- Reading Time: ${post.data.readingTime} min`,
    `- Related Project: ${project ? `${project.label}${project.externalRepoUrl ? ` (${project.externalRepoUrl})` : ` (${origin}${project.href})`}` : post.data.project}`,
    `- Tags: ${post.data.tags.join(', ')}`,
    ``,
    `---`,
    ``,
    post.body ?? '',
  ].join('\n');

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
};
