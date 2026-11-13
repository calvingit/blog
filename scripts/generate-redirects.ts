/**
 * Build public/_redirects from content + the archived production sitemap.
 * Fails when an archived URL has no rule, or when MDX still links to an old path.
 *
 *   tsx scripts/generate-redirects.ts           # write redirects and guid/lastmod maps
 *   tsx scripts/generate-redirects.ts --rewrite # also rewrite old MDX links
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { getTags } from '../src/tags.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const rewrite = process.argv.includes('--rewrite')

const STABLE = new Set(['/', '/about/', '/blog/'])
const RESERVED_SLUGS = new Set([
  'about',
  'blog',
  'tags',
  'weekly',
  'rss.xml',
  'favicon.svg',
  'robots.txt',
  'og-image.png',
  'pagefind',
  '404',
])

interface Article {
  slug: string
  lastUpdated: string
  tags: string[]
  file: string
}

interface WeeklyPost extends Article {
  series: string
}

function walk(dir: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_'))
      continue
    const full = join(dir, name)
    if (statSync(full).isDirectory())
      files.push(...walk(full))
    else if (name.endsWith('.mdx'))
      files.push(full)
  }
  return files
}

function isoDate(value: unknown, file: string): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime()))
    throw new Error(`Invalid lastUpdated in ${relative(root, file)}`)
  return date.toISOString()
}

function loadBlog(): Article[] {
  return walk(join(root, 'content/blog')).map((file) => {
    const { data } = matter(readFileSync(file, 'utf8'))
    return {
      slug: String(data.slug),
      lastUpdated: isoDate(data.lastUpdated, file),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      file,
    }
  })
}

function loadWeekly(): WeeklyPost[] {
  return walk(join(root, 'content/weekly')).map((file) => {
    const { data } = matter(readFileSync(file, 'utf8'))
    return {
      slug: String(data.slug),
      series: String(data.series),
      lastUpdated: isoDate(data.lastUpdated, file),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      file,
    }
  })
}

function loadArchive(): string[] {
  const xml = readFileSync(join(root, 'scripts/data/legacy-sitemap.xml'), 'utf8')
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decodeURIComponent(new URL(match[1]).pathname))
}

function withSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`
}

function withoutSlash(path: string): string {
  if (path === '/')
    return path
  return path.endsWith('/') ? path.slice(0, -1) : path
}

function sourceForms(path: string): string[] {
  const slash = withSlash(path)
  const bare = withoutSlash(path)
  return [...new Set([bare, slash, encodeURI(bare), encodeURI(slash)])]
}

interface Redirect {
  source: string
  destination: string
}

const blog = loadBlog()
const weekly = loadWeekly()
const blogSlugs = new Set(blog.map(post => post.slug))

for (const post of blog) {
  if (!post.slug || post.slug.includes('/') || RESERVED_SLUGS.has(post.slug))
    throw new Error(`Blog slug is empty, nested, or reserved: ${post.slug}`)
}
for (const post of weekly) {
  if (!post.slug || post.slug.includes('/') || !post.series)
    throw new Error(`Weekly slug is invalid in ${relative(root, post.file)}`)
}

const pairs = new Map<string, string>()
const lastmod: Record<string, string> = {}
const guids: Record<string, string> = {}

for (const post of blog) {
  const oldPath = `/${post.slug}/`
  const newPath = `/blog/${post.slug}/`
  pairs.set(oldPath, newPath)
  lastmod[new URL(newPath, 'https://zhangwen.site').href] = post.lastUpdated
  guids[newPath] = `https://zhangwen.site${oldPath}`
}

for (const post of weekly) {
  const oldPath = `/weekly/${post.series}/${post.slug}/`
  const newPath = `/blog/weekly/${post.series}/${post.slug}/`
  pairs.set(oldPath, newPath)
  lastmod[new URL(newPath, 'https://zhangwen.site').href] = post.lastUpdated
  guids[newPath] = `https://zhangwen.site${oldPath}`
}

pairs.set('/weekly/', '/blog/weekly/')
for (const series of ['ai', 'frontend', 'reading'])
  pairs.set(`/weekly/${series}/`, `/blog/weekly/${series}/`)

pairs.set('/tags/', '/blog/tags/')
const tagEntries = getTags([
  ...blog.map(post => ({ id: post.file, data: { tags: post.tags } })),
  ...weekly.map(post => ({ id: post.file, data: { tags: post.tags } })),
])
for (const tag of tagEntries)
  pairs.set(`/tags/${tag.slug}/`, `/blog/tags/${tag.slug}/`)

const archive = loadArchive()
if (archive.length !== 346)
  throw new Error(`Archived sitemap has ${archive.length} URLs, expected 346`)

const archiveMigratable = archive.filter(path => !STABLE.has(path))
const missingFromContent = archiveMigratable.filter(path => !pairs.has(path))
const extraInContent = [...pairs.keys()].filter(path => !archive.includes(path))

if (missingFromContent.length || extraInContent.length) {
  const sample = [
    ...missingFromContent.slice(0, 20).map(path => `  missing ${path}`),
    ...extraInContent.slice(0, 20).map(path => `  extra ${path}`),
  ]
  throw new Error(`Redirect map does not match the archived sitemap:\n${sample.join('\n')}`)
}

const redirects: Redirect[] = []
for (const [oldPath, newPath] of [...pairs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  for (const source of sourceForms(oldPath))
    redirects.push({ source, destination: encodeURI(newPath) })
}

redirects.push(
  { source: '/blog/rss.xml', destination: '/rss.xml' },
  { source: '/blog/rss.xml/', destination: '/rss.xml' },
)

const seen = new Set<string>()
for (const rule of redirects) {
  if (seen.has(rule.source))
    throw new Error(`Duplicate redirect source ${rule.source}`)
  seen.add(rule.source)
  if (rule.source.includes('*') || rule.source.includes(':') || rule.destination.includes('*') || rule.destination.includes(':'))
    throw new Error(`Wildcard or placeholder in redirect: ${rule.source} -> ${rule.destination}`)
  if (STABLE.has(withSlash(rule.source)) || rule.source === '/rss.xml' || rule.source === '/rss.xml/')
    throw new Error(`Stable URL must not redirect: ${rule.source}`)
}

if (redirects.length > 2000)
  throw new Error(`Redirect count ${redirects.length} exceeds the Cloudflare Pages limit of 2000`)

const lines = [
  '# Generated by scripts/generate-redirects.ts — do not edit by hand.',
  '# Static exact 301s. Non-ASCII paths are listed both decoded and percent-encoded.',
  '# No wildcards. /, /blog/, /about/, and /rss.xml are intentionally absent.',
  ...redirects.map(rule => `${rule.source}  ${rule.destination}  301`),
  '',
]
writeFileSync(join(root, 'public/_redirects'), lines.join('\n'))

const sortedGuids = Object.fromEntries(Object.entries(guids).sort(([a], [b]) => a.localeCompare(b)))
const sortedLastmod = Object.fromEntries(Object.entries(lastmod).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(join(root, 'src/generated/legacy-guids.json'), `${JSON.stringify(sortedGuids, null, 2)}\n`)
writeFileSync(join(root, 'src/generated/lastmod.json'), `${JSON.stringify(sortedLastmod, null, 2)}\n`)

function rewritePath(pathname: string): string | null {
  const slash = withSlash(pathname)
  if (slash === '/reading/')
    return '/blog/weekly/reading/'
  if (slash === '/' || slash === '/about/' || slash === '/blog/' || pathname === '/rss.xml')
    return null
  if (slash.startsWith('/blog/'))
    return slash === pathname ? null : slash
  if (slash.startsWith('/weekly/') || slash.startsWith('/tags/'))
    return `/blog${slash}`
  const slug = slash.slice(1, -1)
  if (!slug.includes('/') && blogSlugs.has(slug))
    return `/blog/${slug}/`
  return null
}

function rewriteHref(href: string): string | null {
  let url: URL
  if (href.startsWith('/'))
    url = new URL(href, 'https://zhangwen.site')
  else if (href.startsWith('https://zhangwen.site/') || href.startsWith('http://zhangwen.site/'))
    url = new URL(href)
  else
    return null

  const path = rewritePath(decodeURI(url.pathname))
  if (!path)
    return null
  const next = `${path}${url.search}${url.hash}`
  return next === href ? null : next
}

function proseParts(text: string): string[] {
  return text.split('```')
}

const linkFiles = [
  ...walk(join(root, 'content')),
  ...walk(join(root, 'src/assets')),
]
const stale: string[] = []

for (const file of linkFiles) {
  const original = readFileSync(file, 'utf8')
  const parts = proseParts(original)
  let changed = false
  for (let index = 0; index < parts.length; index += 2) {
    parts[index] = parts[index].replace(/\]\(([^)\s]+)\)/g, (full, href: string) => {
      const next = rewriteHref(href)
      if (!next)
        return full
      changed = true
      return `](${next})`
    })
  }
  const updated = parts.join('```')
  if (rewrite && changed)
    writeFileSync(file, updated)

  const scanned = rewrite && changed ? updated : original
  const visible = proseParts(scanned).filter((_, index) => index % 2 === 0).join('\n')
  for (const match of visible.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (rewriteHref(match[1]))
      stale.push(`${relative(root, file)} ${match[1]}`)
  }
}

if (stale.length) {
  throw new Error(`Old internal links remain:\n${stale.slice(0, 30).join('\n')}`)
}

const encodedOnly = redirects.filter(rule => rule.source.includes('%')).length
console.log(`articles ${blog.length}`)
console.log(`weekly ${weekly.length}`)
console.log(`tags ${tagEntries.length}`)
console.log(`archived ${archive.length}`)
console.log(`migratable ${archiveMigratable.length}`)
console.log(`redirect rules ${redirects.length} (encoded duplicates ${encodedOnly})`)
console.log(`legacy guids ${Object.keys(sortedGuids).length}`)
