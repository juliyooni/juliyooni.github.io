import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const postSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  lang: z.enum(['ko', 'en']).default('ko'),
  series: z.string().optional(),
  seriesOrder: z.number().optional(),
  draft: z.boolean().default(false),
});

const mir = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/mir' }),
  schema: postSchema,
});

const essays = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/essays' }),
  schema: postSchema,
});

export const collections = { mir, essays };
