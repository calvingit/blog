/**
 * Acceptance checks for the /blog migration against a deployed origin.
 *
 *   tsx scripts/verify-preview.ts https://<preview>.pages.dev
 *
 * Prints old URL → status → Location → final status, then sitemap, RSS,
 * crawl, and 404 results. Exits 1 when any check fails.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const baseArg = process.argv[2]?.replace(/\/$/, '')
if (!baseArg) {
  console.error('Usage: tsx scripts/verify-preview.ts <origin>')
  process.exit(1)
}

const origin = new URL(baseArg).origin
const root = fileURLToPath(new URL('..', import.meta.url))
const archiveXml = readFileSync(`${root}/scripts/data/legacy-sitemap.xml`, 'utf8')
const archive = [...archiveXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decodeURIComponent(new URL(match[1]).pathname))
const stable = new Set(['/', '/about/', '/blog/'])
const migratable = archive.filter(path => !stable.has(path))

interface Failure {
  check: string
  detail: string
}

const failures: Failure[] = []
const lines: string[] = []

function fail(check: string, detail: string) {
  failures.push({ check, detail })
}

function pathnameOf(location: string): string {
  return decodeURIComponent(new URL(location, origin).pathname)
}

async function request(url: string, redirect: RequestRedirect = 'manual') {
  const response = await fetch(url, { redirect })
  return {
    status: response.status,
    location: response.headers.get('location'),
    type: response.headers.get('content-type') ?? '',
    text: async () => response.text(),
    bytes: Number(response.headers.get('content-length') ?? 0),
  }
}

async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let index = 0
  await Promise.all(Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await task(current)
    }
  }))
}

function expectedDestination(oldPath: string): string {
  if (oldPath === '/weekly/' || oldPath.startsWith('/weekly/'))
    return `/blog${oldPath}`
  if (oldPath === '/tags/' || oldPath.startsWith('/tags/'))
    return `/blog${oldPath}`
  return `/blog${oldPath}`
}

async function checkRedirect(oldPath: string, variant: 'slash' | 'bare') {
  const source = variant === 'slash' ? oldPath : oldPath.replace(/\/$/, '')
  const target = expectedDestination(oldPath)
  const url = new URL(encodeURI(source), origin).href
  const first = await request(url)
  const locationPath = first.location ? pathnameOf(first.location) : ''
  const locationHost = first.location ? new URL(first.location, origin).host : ''
  let finalStatus = 0
  if (first.status === 301 && locationPath === target && locationHost === new URL(origin).host) {
    const second = await request(new URL(first.location!, origin).href)
    finalStatus = second.status
    if (second.status !== 200)
      fail('redirect-final', `${source} final ${second.status}`)
  }
  else {
    fail('redirect', `${source} ${first.status} ${first.location ?? ''} expected 301 ${target}`)
  }
  lines.push(`${source}\t${first.status}\t${first.location ?? ''}\t${finalStatus || '-'}`)
}

console.log(`origin ${origin}`)
console.log(`archived ${archive.length} migratable ${migratable.length}`)

await pool(migratable, 12, async (path) => {
  await checkRedirect(path, 'slash')
})
await pool(migratable, 12, async (path) => {
  await checkRedirect(path, 'bare')
})

const redirectPasses = lines.filter(line => line.includes('\t301\t') && line.endsWith('\t200')).length
console.log(`redirect rows ${lines.length} pass ${redirectPasses} fail ${lines.length - redirectPasses}`)

for (const path of ['/', '/blog/', '/about/', '/rss.xml']) {
  const response = await request(new URL(path, origin).href)
  console.log(`stable ${path} ${response.status} ${response.location ?? ''}`)
  if (response.status !== 200 || response.location)
    fail('stable', `${path} ${response.status} ${response.location ?? ''}`)
}

const robots = await request(new URL('/robots.txt', origin).href)
const robotsText = await robots.text()
console.log(`robots ${robots.status} ${robots.type}`)
const sitemapLine = robotsText.match(/^Sitemap:\s*(\S+)/m)?.[1]
if (robots.status !== 200 || !robots.type.includes('text/plain') || sitemapLine !== 'https://zhangwen.site/sitemap-index.xml')
  fail('robots', `status ${robots.status} sitemap ${sitemapLine ?? 'missing'}`)

function onOrigin(url: string): string {
  if (new URL(origin).host === 'zhangwen.site')
    return url
  const parsed = new URL(url)
  return new URL(`${parsed.pathname}${parsed.search}`, origin).href
}

async function sitemapLocs(url: string): Promise<string[]> {
  const response = await request(onOrigin(url))
  const xml = await response.text()
  if (response.status !== 200)
    fail('sitemap', `${url} ${response.status}`)
  const indexes = [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map(match => match[1])
  if (indexes.length) {
    const nested = await Promise.all(indexes.map(loc => sitemapLocs(loc)))
    return nested.flat()
  }
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
}

// robots.txt names the production sitemap. On a preview, that URL is still the
// live site, so read this deployment's /sitemap-index.xml instead.
const locs = await sitemapLocs(new URL(origin).host === 'zhangwen.site'
  ? 'https://zhangwen.site/sitemap-index.xml'
  : new URL('/sitemap-index.xml', origin).href)
const oldLocs = locs.filter((loc) => {
  const path = decodeURIComponent(new URL(loc).pathname)
  return path.startsWith('/weekly/') || path.startsWith('/tags/') || migratable.includes(path)
})
console.log(`sitemap locs ${locs.length} old ${oldLocs.length}`)
if (locs.length !== 346)
  fail('sitemap-count', `got ${locs.length}`)
if (oldLocs.length)
  fail('sitemap-old', oldLocs.slice(0, 5).join(' '))

const canonicalMisses: string[] = []
await pool(locs, 12, async (loc) => {
  const path = new URL(loc).pathname
  const response = await request(new URL(path, origin).href)
  const html = await response.text()
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
  if (response.status !== 200 || canonical !== loc)
    canonicalMisses.push(`${path} ${response.status} canonical=${canonical ?? 'missing'} loc=${loc}`)
})
console.log(`canonical checked ${locs.length} mismatches ${canonicalMisses.length}`)
for (const miss of canonicalMisses.slice(0, 8))
  fail('canonical', miss)

const rssResponse = await request(new URL('/rss.xml', origin).href)
const rss = await rssResponse.text()
const itemLinks = [...rss.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map(match => match[1])
const guids = [...rss.matchAll(/<guid([^>]*)>([^<]+)<\/guid>/g)]
const channelLink = rss.match(/<channel>[\s\S]*?<link>([^<]+)<\/link>/)?.[1]
const language = rss.match(/<language>([^<]+)<\/language>/)?.[1]
const description = rss.match(/<channel>[\s\S]*?<description>([^<]+)<\/description>/)?.[1]
const selfLink = rss.includes('rel="self"') && rss.includes('https://zhangwen.site/rss.xml')
console.log(`rss ${rssResponse.status} items ${itemLinks.length} language ${language} channel ${channelLink}`)
console.log(`rss description ${description}`)
if (rssResponse.status !== 200)
  fail('rss', `status ${rssResponse.status}`)
if (channelLink !== 'https://zhangwen.site/blog/')
  fail('rss-channel', channelLink ?? 'missing')
if (description !== '张文的技术博客，关注 AI Coding、Agent 软件工程，以及移动端与 Web 开发。')
  fail('rss-description', description ?? 'missing')
if (!language || language.toLowerCase() === 'en-us')
  fail('rss-language', language ?? 'missing')
if (!selfLink)
  fail('rss-atom', 'missing atom:link rel=self')
if (guids.length !== itemLinks.length)
  fail('rss-guid-count', `${guids.length} guids for ${itemLinks.length} items`)
const permalinkTrue = guids.filter(match => match[1].includes('isPermaLink="true"'))
if (permalinkTrue.length)
  fail('rss-guid-perma', `${permalinkTrue.length} guids still isPermaLink=true`)
const offBlog = itemLinks.filter(link => !new URL(link).pathname.startsWith('/blog/'))
if (offBlog.length)
  fail('rss-links', offBlog.slice(0, 3).join(' '))

const blogRss = await request(new URL('/blog/rss.xml', origin).href)
const blogRssPath = blogRss.location ? pathnameOf(blogRss.location) : ''
console.log(`blog rss ${blogRss.status} ${blogRss.location ?? ''}`)
if (blogRss.status !== 301 || blogRssPath !== '/rss.xml')
  fail('blog-rss', `${blogRss.status} ${blogRss.location ?? ''}`)

let deadRssLinks = 0
await pool(itemLinks, 12, async (link) => {
  const path = new URL(link).pathname
  const response = await request(new URL(path, origin).href)
  if (response.status !== 200)
    deadRssLinks += 1
})
console.log(`rss link 200s ${itemLinks.length - deadRssLinks}/${itemLinks.length}`)
if (deadRssLinks)
  fail('rss-link-status', `${deadRssLinks} item links are not 200`)

const samples = [
  locs.find(loc => /\/blog\/[^/]+\/$/.test(new URL(loc).pathname) && !new URL(loc).pathname.startsWith('/blog/weekly') && !new URL(loc).pathname.startsWith('/blog/tags')),
  locs.find(loc => /\/blog\/weekly\/[^/]+\/[^/]+\/$/.test(new URL(loc).pathname)),
  locs.find(loc => new URL(loc).pathname === '/blog/'),
  locs.find(loc => new URL(loc).pathname === '/blog/weekly/'),
  locs.find(loc => new URL(loc).pathname === '/blog/weekly/ai/'),
  locs.find(loc => new URL(loc).pathname === '/blog/weekly/reading/'),
  locs.find(loc => new URL(loc).pathname === '/blog/tags/'),
  locs.find(loc => new URL(loc).pathname.startsWith('/blog/tags/') && new URL(loc).pathname !== '/blog/tags/'),
  `${origin}/about/`,
  `${origin}/`,
].filter(Boolean) as string[]

function decodeHtml(value: string) {
  return value
    .replaceAll('&#39;', '\'')
    .replaceAll('&apos;', '\'')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
}

console.log('titles')
for (const loc of samples) {
  const path = new URL(loc, origin).pathname
  const response = await request(new URL(path, origin).href)
  const html = await response.text()
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
  console.log(`  ${decodeURIComponent(path)} ${decodeHtml(title)}`)
}

const home = await (await request(new URL('/', origin).href)).text()
const homeTypes = [...home.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(match => match[1])
console.log(`home jsonld blocks ${homeTypes.length}`)
if (!home.includes('"@type":"WebSite"') && !home.includes('"@type": "WebSite"'))
  fail('jsonld-home', 'missing WebSite')
if (!home.includes('张文'))
  fail('jsonld-person', 'missing 张文')
if (!home.includes('https://github.com/calvingit') || !home.includes('https://x.com/calvin_cheung0'))
  fail('jsonld-sameas', 'missing sameAs')

const articleLocs = locs.filter(loc => /\/blog\/weekly\/[^/]+\/[^/]+\/$/.test(new URL(loc).pathname) || (/^\/blog\/[^/]+\/$/.test(new URL(loc).pathname) && !new URL(loc).pathname.startsWith('/blog/weekly') && !new URL(loc).pathname.startsWith('/blog/tags'))).slice(0, 3)
for (const loc of articleLocs) {
  const html = await (await request(new URL(new URL(loc).pathname, origin).href)).text()
  const og = html.match(/property="og:type" content="([^"]+)"/)?.[1]
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
  const ogUrl = html.match(/property="og:url" content="([^"]+)"/)?.[1]
  console.log(`article ${new URL(loc).pathname} og=${og} posting=${html.includes('BlogPosting')}`)
  if (og !== 'article')
    fail('og-type', `${loc} ${og}`)
  if (!html.includes('BlogPosting') || !html.includes('datePublished') || !html.includes('dateModified') || !html.includes('mainEntityOfPage'))
    fail('jsonld-post', loc)
  if (ogUrl !== canonical)
    fail('og-url', `${loc} og=${ogUrl} canonical=${canonical}`)
}

const homeOg = home.match(/property="og:type" content="([^"]+)"/)?.[1]
console.log(`home og:type ${homeOg}`)
if (homeOg !== 'website')
  fail('og-home', homeOg ?? 'missing')

const image = await request(new URL('/og-image.png', origin).href)
console.log(`og-image ${image.status} ${image.type}`)
if (image.status !== 200 || !image.type.startsWith('image/'))
  fail('og-image', `${image.status} ${image.type}`)

const redirectsFile = readFileSync(`${root}/public/_redirects`, 'utf8')
const rules = redirectsFile.split('\n').filter(line => line && !line.startsWith('#'))
const wild = rules.filter(line => line.includes('*') || /(?:^|\s):/.test(line))
console.log(`_redirects rules ${rules.length} wildcards ${wild.length}`)
if (rules.length >= 2000 || wild.length || rules.some(line => !line.endsWith(' 301')))
  fail('redirects-file', `rules ${rules.length} wild ${wild.length}`)

for (const path of ['/not-exist-xyz/', '/not-exist-xyz', '/2017/03/05/app-version/', '/this-file-does-not-exist.png']) {
  const response = await request(new URL(path, origin).href)
  const html = await response.text()
  const noindex = html.includes('name="robots" content="noindex"')
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
  console.log(`404 ${path} ${response.status} noindex=${noindex} title=${title} bytes=${html.length}`)
  if (response.status !== 404 || !noindex || !html.includes('页面未找到'))
    fail('404', `${path} ${response.status} noindex=${noindex}`)
}

const crawled = new Set<string>()
const legacyHits: string[] = []
const broken: string[] = []
await pool(locs, 8, async (loc) => {
  const html = await (await request(new URL(new URL(loc).pathname, origin).href)).text()
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1]
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:'))
      continue
    let url: URL
    try {
      url = new URL(href, origin)
    }
    catch {
      continue
    }
    if (url.host !== new URL(origin).host && url.host !== 'zhangwen.site' && url.host !== 'www.zhangwen.site')
      continue
    const path = decodeURIComponent(url.pathname)
    if (migratable.includes(path) || migratable.includes(path.endsWith('/') ? path : `${path}/`))
      legacyHits.push(`${new URL(loc).pathname} -> ${path}`)
    const key = path
    if (crawled.has(key) || path.startsWith('/_astro/') || path.startsWith('/pagefind/'))
      continue
    crawled.add(key)
  }
})

await pool([...crawled], 12, async (path) => {
  const response = await request(new URL(encodeURI(path), origin).href)
  if (response.status === 404)
    broken.push(path)
})
console.log(`crawled internal paths ${crawled.size} legacy links ${legacyHits.length} 404s ${broken.length}`)
for (const hit of legacyHits.slice(0, 8))
  fail('legacy-link', hit)
for (const path of broken.slice(0, 8))
  fail('crawl-404', path)

const host = new URL(origin).hostname
if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.pages.dev')) {
  console.log('www sample skipped: this host has no www → apex rule. Re-check AC7/AC12-4 on production.')
}
else {
  try {
    const www = await request(`https://www.${host}/blog/`, 'follow')
    console.log(`www status ${www.status}`)
  }
  catch (error) {
    console.log(`www unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }
}

console.log('redirect sample')
for (const line of [lines[0], lines[1], lines.find(line => line.startsWith('/weekly/')), lines.find(line => line.startsWith('/tags/')), lines.find(line => line.includes('%'))].filter(Boolean))
  console.log(`  ${line}`)

console.log(`RESULT failures ${failures.length}`)
for (const item of failures)
  console.log(`FAIL ${item.check} ${item.detail}`)

if (failures.length)
  process.exit(1)
