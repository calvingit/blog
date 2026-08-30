import type { CollectionEntry } from 'astro:content'
import { getCollection } from 'astro:content'

export type SiteContentEntry
  = | CollectionEntry<'blog'>
    | CollectionEntry<'weekly'>

export const WEEKLY_SERIES = {
  ai: {
    title: 'AI Software Engineering Weekly',
    description: '面向有经验的软件工程师，梳理真正影响工程决策的 AI 软件工程变化。',
  },
  frontend: {
    title: 'Frontend & Mobile Engineering Weekly',
    description: '汇总前端与移动端生态中值得纳入工程决策的进展。',
  },
  reading: {
    title: '摸鱼精选',
    description: '每期汇总近期值得阅读的技术文章、项目与工程实践。',
  },
} as const

export type WeeklySeries = keyof typeof WEEKLY_SERIES

export function getWeeklySeries(entry: CollectionEntry<'weekly'>): WeeklySeries {
  return entry.data.series
}

export function getContentUrl(entry: SiteContentEntry): string {
  if (entry.collection === 'weekly') {
    return `/weekly/${getWeeklySeries(entry)}/${entry.data.slug}/`
  }

  return `/${entry.data.slug}/`
}

export async function getWeeklyEntries(): Promise<Array<CollectionEntry<'weekly'>>> {
  return getCollection('weekly')
}

export async function getAllContentEntries(): Promise<SiteContentEntry[]> {
  const [blog, weekly] = await Promise.all([
    getCollection('blog'),
    getWeeklyEntries(),
  ])

  return [...blog, ...weekly]
}
