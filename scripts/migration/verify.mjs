import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'
import { buildMigration, canonicalPath, decodePath, KEEP_PATHS, ORIGIN, pathVariants, RSS_PATH, unescapeXml } from './lib.mjs'

const HOME_TITLE = 'Calvin｜软件开发与 AI 工程实践'
const HOME_DESCRIPTION = '这里持续关注 AI Coding、Agent 软件工程的发展。'
const RSS_DESCRIPTION = 'Calvin 的技术博客，关注 AI Coding、Agent 软件工程，以及移动端与 Web 开发。'
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=')
  return [key, value ?? 'true']
}))
const outPath = args.get('out') || '/opt/cursor/artifacts/migration-verify.json'
const concurrency = Number(args.get('concurrency') || 16)

const migration = buildMigration()
const redirectsPath = path.join(process.cwd(), 'public/_redirects')
const redirectsText = fs.readFileSync(redirectsPath, 'utf8')
const results = []

function record(row) {
  results.push(row)
  return row.ok
}

function finish(extra = {}) {
  const failures = results.filter(row => !row.ok)
  const report = {
    ok: failures.length === 0,
    counts: migration.counts,
    checked: results.length,
    failed: failures.length,
    www: {
      tested: false,
      reason: 'www is at most two hops and can only be verified on production DNS. This run did not claim it.',
    },
    pagination: extra.pagination || { routes: 0, note: 'No /page/n/ list pagination exists, and none was added.' },
    ...extra,
    failures,
    results,
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({
    ok: report.ok,
    counts: report.counts,
    checked: report.checked,
    failed: report.failed,
    out: outPath,
    www: report.www,
    sampleFailures: failures.slice(0, 20),
  }, null, 2))
  process.exit(report.ok ? 0 : 1)
}

if (redirectsText !== migration.redirects) {
  record({ ok: false, kind: 'redirect-file', detail: 'public/_redirects does not match scripts/migration/generate.mjs' })
  finish()
}
record({ ok: !redirectsText.includes('*') && !redirectsText.includes(':splat'), kind: 'redirect-file', detail: 'exact rules only' })
record({
  ok: migration.counts.sitemapLocs === 346 && migration.counts.migrated === 343 && migration.counts.rssGuids === 231,
  kind: 'baseline-counts',
  detail: migration.counts,
})

const rules = migration.rules.map(rule => [rule.source, rule.destination])
const ruleMap = new Map(rules)
const oldPaths = new Set(migration.mappings.map(item => item.oldPath))
const newPaths = new Set(migration.newPages)

function locationParts(location, base) {
  const url = new URL(location, base)
  return { path: decodePath(url.pathname), encoded: url.pathname, query: url.search, href: url.href }
}

function wirePath(requestPath) {
  const cut = requestPath.indexOf('?')
  const pathname = cut === -1 ? requestPath : requestPath.slice(0, cut)
  const search = cut === -1 ? '' : requestPath.slice(cut)
  const wired = pathname.split('/').map((part) => {
    if (!part || part.includes('%'))
      return part
    return encodeURIComponent(part)
  }).join('/')
  return `${wired}${search}`
}

function requestOnce(base, requestPath) {
  const url = new URL(base)
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: wirePath(requestPath),
      method: 'GET',
      headers: { 'accept': '*/*', 'user-agent': 'Mozilla/5.0 migration-verify' },
    }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        location: res.headers.location || '',
        contentType: String(res.headers['content-type'] || ''),
        body: Buffer.concat(chunks),
      }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function pool(items, worker) {
  let cursor = 0
  async function run() {
    while (cursor < items.length)
      await worker(items[cursor++])
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run))
}

function startServer(dist) {
  const server = http.createServer((req, res) => {
    const host = req.headers.host || '127.0.0.1'
    const raw = req.url || '/'
    const cut = raw.indexOf('?')
    const pathname = cut === -1 ? raw : raw.slice(0, cut)
    const search = cut === -1 ? '' : raw.slice(cut)
    const destination = ruleMap.get(pathname)
    if (destination) {
      const target = destination.includes('?') ? destination : `${destination}${search}`
      res.writeHead(301, { Location: new URL(target, `http://${host}`).href })
      res.end()
      return
    }
    let decoded = pathname
    try {
      decoded = decodeURIComponent(pathname)
    }
    catch {
      // The request path is not a single valid encoding. Treat it as missing.
    }
    const relative = decoded.replace(/^\/+/, '')
    const candidates = []
    if (!relative) {
      candidates.push(path.join(dist, 'index.html'))
    }
    else if (relative.endsWith('/')) {
      candidates.push(path.join(dist, relative, 'index.html'))
    }
    else {
      candidates.push(path.join(dist, relative))
      candidates.push(path.join(dist, relative, 'index.html'))
    }
    const file = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    if (!file) {
      const missing = fs.readFileSync(path.join(dist, '404.html'))
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      res.end(missing)
      return
    }
    if (pathname !== '/' && !pathname.endsWith('/') && !path.extname(pathname) && file.endsWith(`${path.sep}index.html`)) {
      res.writeHead(308, { Location: new URL(`${pathname}/`, `http://${host}`).href })
      res.end()
      return
    }
    const type = file.endsWith('.html')
      ? 'text/html; charset=utf-8'
      : file.endsWith('.xml')
        ? 'application/xml; charset=utf-8'
        : file.endsWith('.png')
          ? 'image/png'
          : file.endsWith('.svg')
            ? 'image/svg+xml'
            : 'application/octet-stream'
    res.writeHead(200, { 'content-type': type })
    res.end(fs.readFileSync(file))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, base: `http://127.0.0.1:${address.port}` })
    })
  })
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/g) || []
  const tag = tags.find(item => new RegExp(`\\bname=["']${name}["']`).test(item) || new RegExp(`\\bproperty=["']${name}["']`).test(item))
  const content = tag?.match(/\bcontent=["']([^"']*)["']/)
  return content ? unescapeXml(content[1]) : ''
}

function titleOf(html) {
  const match = html.match(/<title>([^<]*)<\/title>/)
  return match ? unescapeXml(match[1]) : ''
}

function canonicalOf(html) {
  const tags = html.match(/<link\b[^>]*>/g) || []
  const tag = tags.find(item => /\brel=["']canonical["']/.test(item))
  const href = tag?.match(/\bhref=["']([^"']+)["']/)
  return href ? unescapeXml(href[1]) : ''
}

async function checkRedirect(base, source, destination, query = '') {
  const requestPath = `${source}${query}`
  const first = await requestOnce(base, requestPath)
  const location = first.location ? locationParts(first.location, base) : null
  const expected = decodePath(destination)
  let followed = 0
  if (location && first.status >= 300 && first.status < 400) {
    const second = await requestOnce(base, `${location.encoded}${location.query}`)
    followed = second.status
  }
  const ok = first.status === 301
    && location?.path === expected
    && (!query || location.query === query)
    && followed === 200
  record({
    ok,
    kind: 'redirect',
    source,
    query,
    status: first.status,
    location: first.location,
    followed,
  })
}

async function verifyHttp(base) {
  const probes = []
  for (const mapping of migration.mappings) {
    const slashed = mapping.oldPath
    const bare = slashed.slice(0, -1)
    probes.push([slashed, canonicalPath(mapping.newPath), ''])
    probes.push([bare, canonicalPath(mapping.newPath), ''])
    probes.push([slashed, canonicalPath(mapping.newPath), '?utm=qa'])
    probes.push([bare, canonicalPath(mapping.newPath), '?utm=qa'])
    if ([...slashed].some(char => char.charCodeAt(0) > 127)) {
      for (const variant of pathVariants(slashed)) {
        if (variant !== slashed && variant !== bare)
          probes.push([variant, canonicalPath(mapping.newPath), ''])
      }
    }
  }
  probes.push(['/blog/rss.xml', '/rss.xml', ''])
  probes.push(['/blog/rss.xml', '/rss.xml', '?utm=qa'])
  await pool(probes, async ([source, destination, query]) => {
    await checkRedirect(base, source, destination, query)
  })

  for (const keep of [...KEEP_PATHS, RSS_PATH]) {
    const response = await requestOnce(base, keep)
    record({ ok: response.status === 200, kind: 'keep', source: keep, status: response.status, location: response.location })
  }
  for (const keep of ['/about', '/blog']) {
    const response = await requestOnce(base, keep)
    const location = response.location ? locationParts(response.location, base) : null
    const ok = response.status === 200 || ((response.status === 301 || response.status === 308) && location?.path === `${keep}/`)
    record({ ok, kind: 'keep-slash', source: keep, status: response.status, location: response.location })
  }

  await pool(migration.newPages, async (page) => {
    const response = await requestOnce(base, canonicalPath(page))
    const html = response.body.toString('utf8')
    const canonical = canonicalOf(html)
    const expected = `${ORIGIN}${canonicalPath(page)}`
    record({
      ok: response.status === 200 && canonical === expected,
      kind: 'page',
      source: page,
      status: response.status,
      canonical,
      title: titleOf(html),
    })
  })

  const home = await requestOnce(base, '/')
  const homeHtml = home.body.toString('utf8')
  record({ ok: titleOf(homeHtml) === HOME_TITLE, kind: 'title', source: '/', title: titleOf(homeHtml) })
  record({ ok: metaContent(homeHtml, 'description') === HOME_DESCRIPTION, kind: 'description', source: '/', description: metaContent(homeHtml, 'description') })
  record({ ok: homeHtml.includes('你好 👋') && !homeHtml.includes('Software Engineer · AI Engineering'), kind: 'home-copy', source: '/' })
  const homeJson = [...homeHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]))
  const homeFlat = JSON.stringify(homeJson)
  record({
    ok: homeFlat.includes('"@type":"WebSite"') && homeFlat.includes('"@type":"Person"') && homeFlat.includes('"name":"Calvin"') && !homeFlat.includes('alternateName') && homeFlat.includes('https://github.com/calvingit') && homeFlat.includes('https://x.com/calvin_cheung0'),
    kind: 'jsonld-home',
    source: '/',
  })

  const titled = [
    ['/blog/', '博客 | Calvin'],
    ['/about/', '关于 | Calvin'],
    ['/blog/weekly/', '周报 | Calvin'],
    ['/blog/tags/', '标签 | Calvin'],
    ['/blog/weekly/ai/', 'AI Software Engineering Weekly | Calvin'],
    ['/blog/weekly/frontend/', 'Frontend & Mobile Engineering Weekly | Calvin'],
    ['/blog/weekly/reading/', '摸鱼精选 | Calvin'],
  ]
  for (const [page, title] of titled) {
    const response = await requestOnce(base, page)
    const html = response.body.toString('utf8')
    record({ ok: titleOf(html) === title, kind: 'title', source: page, title: titleOf(html), expected: title })
    record({
      ok: metaContent(html, 'description') !== HOME_DESCRIPTION && metaContent(html, 'description') !== 'Calvin - Focus on Technology Sharing and Life Thoughts',
      kind: 'description',
      source: page,
      description: metaContent(html, 'description'),
    })
  }
  const tag = migration.mappings.find(item => item.kind === 'tag')
  if (tag) {
    const response = await requestOnce(base, canonicalPath(tag.newPath))
    const html = response.body.toString('utf8')
    record({
      ok: titleOf(html) === `标签：${tag.name} | Calvin`,
      kind: 'title',
      source: tag.newPath,
      title: titleOf(html),
    })
  }

  const post = migration.mappings.find(item => item.kind === 'post')
  const weekly = migration.mappings.find(item => item.kind === 'weekly-post')
  for (const sample of [post, weekly]) {
    const response = await requestOnce(base, canonicalPath(sample.newPath))
    const html = response.body.toString('utf8')
    const json = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]))
    const posting = json.find(item => item['@type'] === 'BlogPosting')
    record({
      ok: metaContent(html, 'og:type') === 'article'
        && posting
        && posting.author?.name === 'Calvin'
        && posting.datePublished
        && posting.dateModified
        && posting.mainEntityOfPage
        && posting.image
        && !JSON.stringify(posting).includes('alternateName'),
      kind: 'article-seo',
      source: sample.newPath,
      ogType: metaContent(html, 'og:type'),
    })
  }

  const unknown = ['/not-exist-xyz/', '/not-exist-xyz', '/2017/03/05/app-version/', '/this-file-does-not-exist.png']
  for (const source of unknown) {
    const response = await requestOnce(base, source)
    const html = response.body.toString('utf8')
    const canonical = canonicalOf(html)
    record({
      ok: response.status === 404
        && html.includes('noindex')
        && html.includes('页面不存在')
        && !html.includes('BlogPosting')
        && canonical !== `${ORIGIN}/`
        && titleOf(html) !== HOME_TITLE,
      kind: 'missing',
      source,
      status: response.status,
      title: titleOf(html),
      canonical,
    })
  }

  const image = await requestOnce(base, '/og-image.png')
  const png = image.body.length > 24 && image.body.readUInt32BE(16) === 1200 && image.body.readUInt32BE(20) === 630
  record({
    ok: image.status === 200 && image.contentType.includes('image/png') && png,
    kind: 'og-image',
    status: image.status,
    contentType: image.contentType,
  })

  const robots = await requestOnce(base, '/robots.txt')
  record({
    ok: robots.status === 200 && robots.body.toString('utf8').includes('Sitemap: https://zhangwen.site/sitemap-index.xml'),
    kind: 'robots',
    status: robots.status,
  })

  const index = await requestOnce(base, '/sitemap-index.xml')
  const indexXml = index.body.toString('utf8')
  const children = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname)
  const locs = []
  for (const child of children) {
    const response = await requestOnce(base, child)
    locs.push(...[...response.body.toString('utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]))
  }
  const expectedLocs = migration.newPages.map(page => `${ORIGIN}${canonicalPath(page)}`)
  const locSet = new Set(locs)
  const expectedSet = new Set(expectedLocs)
  const onlyResponse = [...locSet].filter(item => !expectedSet.has(item))
  const onlyExpected = [...expectedSet].filter(item => !locSet.has(item))
  record({
    ok: index.status === 200 && onlyResponse.length === 0 && onlyExpected.length === 0 && locs.length === 346,
    kind: 'sitemap',
    status: index.status,
    count: locs.length,
    onlyResponse: onlyResponse.slice(0, 8),
    onlyExpected: onlyExpected.slice(0, 8),
  })

  const rss = await requestOnce(base, '/rss.xml')
  const rssXml = rss.body.toString('utf8')
  const channel = rssXml.slice(0, rssXml.indexOf('<item>'))
  const items = [...rssXml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const block = match[1]
    const link = unescapeXml(block.match(/<link>([^<]*)<\/link>/)?.[1] || '')
    const guidTag = block.match(/<guid([^>]*)>([^<]*)<\/guid>/)
    return {
      link,
      guid: unescapeXml(guidTag?.[2] || ''),
      perma: /isPermaLink="false"/.test(guidTag?.[1] || ''),
    }
  })
  const baselineGuids = new Set(migration.guidRecords.map(recordItem => recordItem.guid))
  const responseGuids = new Set(items.map(item => item.guid))
  const missingGuids = [...baselineGuids].filter(item => !responseGuids.has(item))
  const extraGuids = [...responseGuids].filter(item => !baselineGuids.has(item) && !item.startsWith('tag:zhangwen.site,'))
  record({
    ok: rss.status === 200
      && channel.includes(`<title>Calvin</title>`)
      && channel.includes(`<description>${RSS_DESCRIPTION}</description>`)
      && channel.includes('<link>https://zhangwen.site/blog/</link>')
      && channel.includes('<language>zh-Hans</language>')
      && channel.includes('rel="self"')
      && channel.includes('https://zhangwen.site/rss.xml')
      && items.length === 231
      && items.every(item => item.perma)
      && items.every(item => newPaths.has(decodePath(item.link)))
      && missingGuids.length === 0
      && extraGuids.length === 0
      && !rssXml.includes('isPermaLink="true"')
      && !channel.includes('en-us')
      && !channel.includes('张文')
      && !channel.includes('Wen'),
    kind: 'rss',
    status: rss.status,
    items: items.length,
    missingGuids: missingGuids.length,
    extraGuids: extraGuids.slice(0, 5),
    description: unescapeXml(channel.match(/<description>([^<]*)<\/description>/)?.[1] || ''),
  })

  const htmlFiles = []
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory())
        walk(full)
      else if (entry.name.endsWith('.html'))
        htmlFiles.push(full)
    }
  }
  walk(path.join(process.cwd(), 'dist'))
  const hrefs = new Set()
  let oldHref = 0
  let pagination = 0
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8')
    if (/(?:href|src)=["']\/(?:blog\/)?page\/\d+\/?["']/.test(html))
      pagination += 1
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      const href = match[1]
      if (href.startsWith('//') || href.startsWith('#') || href.startsWith('mailto:'))
        continue
      if (!href.startsWith('/') && !href.startsWith(ORIGIN))
        continue
      const pathname = decodePath(href.startsWith(ORIGIN) ? href : href)
      if (oldPaths.has(pathname))
        oldHref += 1
      if (!pathname.includes('/_astro/') && !pathname.startsWith('/pagefind/'))
        hrefs.add(canonicalPath(pathname.endsWith('/') || path.extname(pathname) ? pathname : `${pathname}`))
    }
  }
  record({ ok: oldHref === 0 && pagination === 0, kind: 'internal-href', oldHref, pagination })

  const internal = [...hrefs].filter(item => !item.startsWith('/_astro/'))
  await pool(internal, async (item) => {
    const response = await requestOnce(base, item)
    const ok = response.status === 200 || (item === '/blog/rss.xml' && response.status === 301)
    if (!ok)
      record({ ok: false, kind: 'internal-status', source: item, status: response.status, location: response.location })
  })
  record({ ok: true, kind: 'internal-status-summary', checked: internal.length })

  const pagefindRoot = path.join(process.cwd(), 'dist/pagefind')
  const indexed = new Set()
  function walkIndex(dir) {
    if (!fs.existsSync(dir))
      return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walkIndex(full)
      }
      else {
        let data = fs.readFileSync(full)
        if (data.length >= 2 && data[0] === 0x1F && data[1] === 0x8B)
          data = zlib.gunzipSync(data)
        const text = data.toString('utf8')
        for (const match of text.matchAll(/"url":"([^"]+)"/g))
          indexed.add(decodePath(match[1]))
      }
    }
  }
  walkIndex(pagefindRoot)
  const indexedOld = [...indexed].filter(item => oldPaths.has(item))
  const indexedMigrated = [...indexed].filter(item => item.startsWith('/blog/') && !KEEP_PATHS.includes(item) && item !== '/blog/')
  record({
    ok: indexed.size > 0 && indexedOld.length === 0,
    kind: 'search-index',
    indexed: indexed.size,
    indexedOld: indexedOld.slice(0, 8),
    migratedResults: indexedMigrated.length,
    keptResults: [...indexed].filter(item => KEEP_PATHS.includes(item) || item === '/about/' || item === '/'),
  })
  await pool([...indexed], async (item) => {
    const response = await requestOnce(base, canonicalPath(item))
    if (response.status !== 200)
      record({ ok: false, kind: 'search-target', source: item, status: response.status })
  })
}

const baseArg = args.get('base')
if (baseArg) {
  await verifyHttp(baseArg)
  finish()
}

const dist = path.join(process.cwd(), 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  record({ ok: false, kind: 'dist', detail: 'dist/ is missing. Run pnpm build first or pass --base.' })
  finish()
}
const hosted = await startServer(dist)
try {
  await verifyHttp(hosted.base)
}
catch (error) {
  record({ ok: false, kind: 'crash', detail: error instanceof Error ? error.stack || error.message : String(error) })
}
finally {
  hosted.server.close()
}
finish()
