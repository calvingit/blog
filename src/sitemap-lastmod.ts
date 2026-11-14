import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { getTagSlug } from './tags'

interface Entry {
  collection: 'blog' | 'weekly'
  slug: string
  series?: string
  tags: string[]
  lastmod: string
  path: string
}

function asDay(value: unknown): string {
  if (value instanceof Date)
    return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))
    return value.slice(0, 10)
  return ''
}

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      files.push(...walk(full))
    else if (entry.name === 'index.mdx')
      files.push(full)
  }
  return files
}

function readEntries(root: string): Entry[] {
  const blogRoot = path.join(root, 'content/blog')
  const weeklyRoot = path.join(root, 'content/weekly')
  const entries: Entry[] = []

  for (const file of walk(blogRoot)) {
    const data = matter(fs.readFileSync(file, 'utf8')).data
    const slug = String(data.slug)
    entries.push({
      collection: 'blog',
      slug,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      lastmod: asDay(data.lastUpdated) || asDay(data.date),
      path: `/blog/${slug}/`,
    })
  }

  for (const file of walk(weeklyRoot)) {
    const data = matter(fs.readFileSync(file, 'utf8')).data
    const slug = String(data.slug)
    const series = String(data.series)
    entries.push({
      collection: 'weekly',
      slug,
      series,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      lastmod: asDay(data.lastUpdated) || asDay(data.date),
      path: `/blog/weekly/${series}/${slug}/`,
    })
  }

  return entries
}

function maxDay(days: string[]): string {
  return days.filter(Boolean).sort().at(-1) || ''
}

function buildMap(root = process.cwd()): Map<string, string> {
  const entries = readEntries(root)
  const map = new Map<string, string>()
  for (const entry of entries) {
    if (entry.lastmod)
      map.set(entry.path, entry.lastmod)
  }

  const blogDays = entries.filter(entry => entry.collection === 'blog').map(entry => entry.lastmod)
  const weeklyDays = entries.filter(entry => entry.collection === 'weekly').map(entry => entry.lastmod)
  const allDays = entries.map(entry => entry.lastmod)
  const blogMax = maxDay(blogDays)
  const weeklyMax = maxDay(weeklyDays)
  const allMax = maxDay(allDays)
  if (blogMax)
    map.set('/blog/', blogMax)
  if (weeklyMax)
    map.set('/blog/weekly/', weeklyMax)
  if (allMax) {
    map.set('/', allMax)
    map.set('/blog/tags/', allMax)
  }

  for (const series of ['ai', 'frontend', 'reading']) {
    const day = maxDay(entries.filter(entry => entry.series === series).map(entry => entry.lastmod))
    if (day)
      map.set(`/blog/weekly/${series}/`, day)
  }

  const tagDays = new Map<string, string[]>()
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const slug = getTagSlug(tag)
      const list = tagDays.get(slug) || []
      list.push(entry.lastmod)
      tagDays.set(slug, list)
    }
  }
  for (const [slug, days] of tagDays) {
    const day = maxDay(days)
    if (day)
      map.set(`/blog/tags/${slug}/`, day)
  }

  return map
}

const lastmodByPath = buildMap()

export function lastmodForUrl(url: string): string | undefined {
  const pathname = decodeURI(new URL(url).pathname)
  const key = pathname.endsWith('/') ? pathname : `${pathname}/`
  return lastmodByPath.get(key)
}
