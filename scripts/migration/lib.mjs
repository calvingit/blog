import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export const ORIGIN = 'https://zhangwen.site'
export const KEEP_PATHS = ['/', '/about/', '/blog/']
export const RSS_PATH = '/rss.xml'
export const BLOG_RSS_PATH = '/blog/rss.xml'
const KEEP_SOURCES = new Set(['/', '/about', '/about/', '/blog', '/blog/', '/rss.xml'])

const root = process.cwd()
const baselineDir = path.join(root, 'scripts/baselines')

function read(name) {
  return fs.readFileSync(path.join(baselineDir, name), 'utf8')
}

export function unescapeXml(value) {
  return value
    .replace(/&apos;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

function normalizeTagName(tag) {
  const normalized = tag.trim().replace(/\s+/g, ' ')
  if (!normalized)
    throw new Error('Tag must not be empty')
  return normalized
}

function getTagSlug(tag) {
  const normalized = normalizeTagName(tag)
  const slug = normalized
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug)
    throw new Error(`Cannot generate a slug for tag "${tag}"`)
  return slug
}

function walk(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      files.push(...walk(full))
    else if (entry.name === 'index.mdx')
      files.push(full)
  }
  return files
}

function asDay(value) {
  if (value instanceof Date)
    return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))
    return value.slice(0, 10)
  return ''
}

export function decodePath(value) {
  const url = value.startsWith('http') ? new URL(value) : new URL(value, ORIGIN)
  let pathname = url.pathname
  try {
    pathname = decodeURIComponent(pathname)
  }
  catch {
    // Keep the raw pathname when a baseline value is not valid UTF-8 percent-encoding.
  }
  if (/\.[a-z0-9]+$/i.test(pathname))
    return pathname
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

export function canonicalPath(pathname) {
  return new URL(pathname, ORIGIN).pathname
}

function lowerPercent(pathname) {
  return pathname.replace(/%[0-9A-F]{2}/g, match => match.toLowerCase())
}

function doublePercent(pathname) {
  return pathname.replace(/%/g, '%25')
}

export function pathVariants(pathname) {
  const slashed = pathname.endsWith('/') ? pathname : `${pathname}/`
  const bare = slashed.slice(0, -1)
  const encoded = canonicalPath(slashed)
  const encodedBare = encoded.slice(0, -1)
  const lower = lowerPercent(encoded)
  const lowerBare = lower.slice(0, -1)
  const doubled = doublePercent(encoded)
  const doubledBare = doublePercent(encodedBare)
  const doubledLower = doublePercent(lower)
  const doubledLowerBare = doublePercent(lowerBare)
  return [...new Set([
    slashed,
    bare,
    encoded,
    encodedBare,
    lower,
    lowerBare,
    doubled,
    doubledBare,
    doubledLower,
    doubledLowerBare,
  ])]
}

function loadSitemapPaths() {
  const locs = [...read('sitemap-0-2026-11-13.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
  const paths = locs.map(decodePath)
  if (new Set(paths).size !== paths.length)
    throw new Error('Baseline sitemap has duplicate decoded paths')
  return { locs, paths }
}

function loadCsvPaths() {
  const lines = read('old-urls-2026-11-13.csv').trim().split(/\r?\n/)
  const header = lines[0].split(',')
  const index = header.indexOf('path')
  if (index < 0)
    throw new Error('Baseline CSV has no path column')
  const raw = lines.slice(1).filter(Boolean).map(line => line.split(',')[index])
  const paths = raw.map(decodePath)
  if (new Set(paths).size !== paths.length)
    throw new Error('Baseline CSV has duplicate decoded paths')
  return { raw, paths }
}

function loadEntries() {
  const entries = []
  for (const file of walk(path.join(root, 'content/blog'))) {
    const data = matter(fs.readFileSync(file, 'utf8')).data
    const slug = String(data.slug || '')
    if (!slug)
      throw new Error(`Missing slug in ${file}`)
    entries.push({
      collection: 'blog',
      slug,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      date: asDay(data.date),
      oldPath: `/${slug}/`,
      newPath: `/blog/${slug}/`,
      kind: 'post',
    })
  }
  for (const file of walk(path.join(root, 'content/weekly'))) {
    const data = matter(fs.readFileSync(file, 'utf8')).data
    const slug = String(data.slug || '')
    const series = String(data.series || '')
    if (!slug || !series)
      throw new Error(`Missing slug or series in ${file}`)
    entries.push({
      collection: 'weekly',
      slug,
      series,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      date: asDay(data.date),
      oldPath: `/weekly/${series}/${slug}/`,
      newPath: `/blog/weekly/${series}/${slug}/`,
      kind: 'weekly-post',
    })
  }
  return entries
}

function loadGuidRecords() {
  const xml = read('rss-2026-11-13.xml')
  const guids = [...xml.matchAll(/<guid isPermaLink="true">([^<]*)<\/guid>/g)].map(match => unescapeXml(match[1]))
  return guids.map(guid => ({ guid, oldPath: decodePath(guid) }))
}

let guidByOldPath

export function baselineGuidForOldPath(oldPath) {
  if (!guidByOldPath) {
    guidByOldPath = new Map()
    for (const record of loadGuidRecords()) {
      if (guidByOldPath.has(record.oldPath))
        throw new Error(`Duplicate baseline guid path ${record.oldPath}`)
      guidByOldPath.set(record.oldPath, record.guid)
    }
  }
  return guidByOldPath.get(oldPath) ?? null
}

export function oldContentPath(entry) {
  if (entry.collection === 'weekly')
    return `/weekly/${entry.data.series}/${entry.data.slug}/`
  return `/${entry.data.slug}/`
}

export function stableGuid(entry) {
  const series = entry.series ? `${entry.series}:` : ''
  return `tag:zhangwen.site,${entry.date}:${entry.collection}:${series}${entry.slug}`
}

function diff(left, right) {
  const onlyLeft = [...left].filter(item => !right.has(item)).sort()
  const onlyRight = [...right].filter(item => !left.has(item)).sort()
  return { onlyLeft, onlyRight }
}

function assertSame(name, leftList, rightList) {
  const result = diff(new Set(leftList), new Set(rightList))
  if (result.onlyLeft.length || result.onlyRight.length) {
    const sample = JSON.stringify({
      onlyLeft: result.onlyLeft.slice(0, 12),
      onlyRight: result.onlyRight.slice(0, 12),
      onlyLeftCount: result.onlyLeft.length,
      onlyRightCount: result.onlyRight.length,
    }, null, 2)
    throw new Error(`${name} sets differ\n${sample}`)
  }
}

export function buildMigration() {
  const sitemap = loadSitemapPaths()
  const csv = loadCsvPaths()
  assertSame('sitemap vs csv', sitemap.paths, csv.paths)

  const entries = loadEntries()
  const reserved = new Set(['', 'about', 'blog', 'rss.xml', 'tags', 'weekly'])
  for (const entry of entries) {
    if (entry.collection === 'blog' && reserved.has(entry.slug))
      throw new Error(`Blog slug collides with a reserved path: ${entry.slug}`)
    if (entry.slug.includes('*') || /:(?=[A-Z])/i.test(entry.slug))
      throw new Error(`Slug is not safe as an exact redirect source: ${entry.slug}`)
  }

  const slugOwners = new Map()
  for (const entry of entries) {
    const key = `${entry.collection}:${entry.series || ''}:${entry.slug}`
    if (slugOwners.has(key))
      throw new Error(`Duplicate content path ${entry.oldPath}`)
    slugOwners.set(key, entry.oldPath)
  }

  const tags = new Map()
  for (const entry of entries) {
    for (const raw of entry.tags) {
      const name = normalizeTagName(raw)
      const slug = getTagSlug(name)
      const existing = tags.get(slug)
      if (existing && existing !== name)
        throw new Error(`Tag slug collision between ${existing} and ${name}`)
      tags.set(slug, name)
    }
  }

  const mappings = entries.map(entry => ({
    kind: entry.kind,
    oldPath: entry.oldPath,
    newPath: entry.newPath,
    guid: baselineGuidForOldPath(entry.oldPath),
  }))

  mappings.push(
    { kind: 'tags-index', oldPath: '/tags/', newPath: '/blog/tags/', guid: null },
    { kind: 'weekly-index', oldPath: '/weekly/', newPath: '/blog/weekly/', guid: null },
    { kind: 'weekly-series', oldPath: '/weekly/ai/', newPath: '/blog/weekly/ai/', guid: null },
    { kind: 'weekly-series', oldPath: '/weekly/frontend/', newPath: '/blog/weekly/frontend/', guid: null },
    { kind: 'weekly-series', oldPath: '/weekly/reading/', newPath: '/blog/weekly/reading/', guid: null },
  )

  for (const [slug, name] of [...tags.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    mappings.push({
      kind: 'tag',
      oldPath: `/tags/${slug}/`,
      newPath: `/blog/tags/${slug}/`,
      guid: null,
      name,
    })
  }

  const oldPaths = mappings.map(item => item.oldPath)
  if (new Set(oldPaths).size !== oldPaths.length)
    throw new Error('Duplicate old paths in the migration map')

  const baselinePaths = sitemap.paths
  const expected = [...KEEP_PATHS, ...oldPaths]
  assertSame('baseline vs content map', baselinePaths, expected)

  const guidRecords = loadGuidRecords()
  const contentOldPaths = entries.map(entry => entry.oldPath)
  assertSame('rss guid paths vs content', guidRecords.map(record => record.oldPath), contentOldPaths)
  const missingGuid = mappings.filter(item => (item.kind === 'post' || item.kind === 'weekly-post') && !item.guid)
  if (missingGuid.length)
    throw new Error(`Content entries missing a baseline guid: ${missingGuid.map(item => item.oldPath).slice(0, 8).join(', ')}`)

  const rawByDecoded = new Map()
  for (const raw of csv.raw) {
    const decoded = decodePath(raw)
    const list = rawByDecoded.get(decoded) || []
    list.push(raw)
    rawByDecoded.set(decoded, list)
  }

  const rules = [{ source: BLOG_RSS_PATH, destination: RSS_PATH }]
  const seen = new Set([BLOG_RSS_PATH])
  for (const mapping of mappings) {
    const destination = canonicalPath(mapping.newPath)
    if (destination === mapping.oldPath)
      throw new Error(`Redirect loop at ${mapping.oldPath}`)
    const sources = new Set(pathVariants(mapping.oldPath))
    for (const raw of rawByDecoded.get(mapping.oldPath) || [])
      sources.add(raw.endsWith('/') ? raw.slice(0, -1) : raw).add(raw.endsWith('/') ? raw : `${raw}/`)
    for (const source of sources) {
      if (KEEP_SOURCES.has(source))
        throw new Error(`Redirect source collides with a kept URL: ${source}`)
      if (source.includes('*') || /:(?=[A-Z])/i.test(source))
        throw new Error(`Unsafe redirect source: ${source}`)
      if (source === destination)
        throw new Error(`Redirect loop at ${source}`)
      if (seen.has(source))
        continue
      seen.add(source)
      rules.push({ source, destination })
    }
  }

  rules.sort((a, b) => b.source.length - a.source.length || (a.source < b.source ? -1 : 1))
  const redirects = renderRedirects(rules)
  if (rules.length > 2000)
    throw new Error(`Redirect rule count ${rules.length} exceeds the 2000 static limit`)
  for (const line of redirects.split('\n')) {
    if (line.startsWith('#') || !line.trim())
      continue
    if (line.length > 1000)
      throw new Error(`Redirect line exceeds 1000 characters: ${line.slice(0, 80)}`)
  }

  const counts = {
    sitemapLocs: sitemap.paths.length,
    csvRows: csv.paths.length,
    rssGuids: guidRecords.length,
    posts: entries.filter(entry => entry.collection === 'blog').length,
    weeklyPosts: entries.filter(entry => entry.collection === 'weekly').length,
    tagPages: tags.size,
    migrated: mappings.length,
    keep: KEEP_PATHS.length,
    redirectRules: rules.length,
  }

  return {
    counts,
    mappings,
    rules,
    redirects,
    guidRecords,
    newPages: [...KEEP_PATHS, ...mappings.map(item => item.newPath)].sort(),
  }
}

export function renderRedirects(rules) {
  const lines = [
    '# Generated by scripts/migration/generate.mjs',
    '# Exact 301 rules only. No splats and no placeholders.',
    ...rules.map(rule => `${rule.source} ${rule.destination} 301`),
    '',
  ]
  return lines.join('\n')
}

export function newPageSet(migration = buildMigration()) {
  return new Set(migration.newPages)
}
