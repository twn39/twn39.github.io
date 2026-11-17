import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(['zh', 'en']),
    translationSlug: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    project: z.string(),
    tags: z.array(z.string()),
    readingTime: z.number(),
    coverImage: z.string(),
    coverAlt: z.string(),
    coverSpec: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { blog };
