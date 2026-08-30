import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'
import { normalizeTags } from './tags'

const postSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  date: z.date(),
  lastUpdated: z.date(),
  tags: z.array(z.string()).min(1).transform(normalizeTags),
  image: z.string().optional(),
  searchIndex: z.boolean().optional().default(true),
})

const blog = defineCollection({
  loader: glob({ pattern: '**\/[^_]*.mdx', base: './content/blog' }),
  schema: postSchema,
})

const weekly = defineCollection({
  loader: glob({ pattern: '**\/[^_]*.mdx', base: './content/weekly' }),
  schema: postSchema.extend({
    series: z.enum(['ai', 'frontend', 'reading']),
  }),
})

export const collections = {
  blog,
  weekly,
}
