import fs from 'node:fs'
import path from 'node:path'
import { buildMigration, KEEP_PATHS, ORIGIN, RSS_PATH } from './lib.mjs'

const root = process.cwd()
const migration = buildMigration()
const oldToNew = new Map(migration.mappings.map(item => [item.oldPath, item.newPath]))
const known = new Set([...oldToNew.values(), ...KEEP_PATHS, RSS_PATH])

function classify(href) {
  if (href.startsWith('//'))
    return null
  let prefix = ''
  let rest = href
  if (href.startsWith(ORIGIN)) {
    prefix = ORIGIN
    rest = href.slice(ORIGIN.length) || '/'
  }
  else if (!href.startsWith('/')) {
    return null
  }
  const cut = rest.search(/[?#]/)
  const suffix = cut === -1 ? '' : rest.slice(cut)
  const pathname = cut === -1 ? rest : rest.slice(0, cut)
  return { prefix, pathname, suffix }
}

function decodePathname(pathname) {
  try {
    const decoded = decodeURIComponent(pathname)
    if (/\.[a-z0-9]+$/i.test(decoded))
      return decoded
    return decoded.endsWith('/') ? decoded : `${decoded}/`
  }
  catch {
    return null
  }
}

export function rewriteHref(href) {
  const parts = classify(href)
  if (!parts)
    return null
  const decoded = decodePathname(parts.pathname)
  if (!decoded)
    return null
  const destination = oldToNew.get(decoded)
  const nextPath = destination || (known.has(decoded) ? decoded : null)
  if (!nextPath)
    return null
  const next = `${parts.prefix}${nextPath}${parts.suffix}`
  return next === href ? null : next
}

function rewritePlain(text) {
  let next = text
  next = next.replace(/\]\(([^)\s]+)\)/g, (full, href) => {
    const rewritten = rewriteHref(href)
    return rewritten ? `](${rewritten})` : full
  })
  next = next.replace(/\bhref=(["'])([^"']+)\1/g, (full, quote, href) => {
    const rewritten = rewriteHref(href)
    return rewritten ? `href=${quote}${rewritten}${quote}` : full
  })
  next = next.replace(/<(https:\/\/zhangwen\.site\/[^>\s]+)>/g, (full, href) => {
    const rewritten = rewriteHref(href)
    return rewritten ? `<${rewritten}>` : full
  })
  next = next.replace(/^(\[[^\]]+\]:\s+)(\S+)/gm, (full, prefix, href) => {
    const rewritten = rewriteHref(href)
    return rewritten ? `${prefix}${rewritten}` : full
  })
  return next
}

function rewriteDocument(text) {
  const parts = text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
  return parts.map((part, index) => index % 2 === 1 ? part : rewritePlain(part)).join('')
}

function walk(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      files.push(...walk(full))
    else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md'))
      files.push(full)
  }
  return files
}

const changed = []
for (const file of walk(path.join(root, 'content'))) {
  const before = fs.readFileSync(file, 'utf8')
  const after = rewriteDocument(before)
  if (after !== before) {
    fs.writeFileSync(file, after)
    changed.push(path.relative(root, file))
  }
}

const unresolved = []
for (const file of walk(path.join(root, 'content'))) {
  const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
  const hrefs = [
    ...text.matchAll(/\]\(([^)\s]+)\)/g),
    ...text.matchAll(/\bhref=(["'])([^"']+)\1/g),
    ...text.matchAll(/<(https:\/\/zhangwen\.site\/[^>\s]+)>/g),
  ].map(match => match[2] || match[1])
  for (const href of hrefs) {
    const parts = classify(href)
    if (!parts)
      continue
    const decoded = decodePathname(parts.pathname)
    if (!decoded || known.has(decoded) || /\.[a-z0-9]+$/i.test(decoded))
      continue
    unresolved.push({ file: path.relative(root, file), href })
  }
}

fs.writeFileSync(path.join(root, 'public/_redirects'), migration.redirects)
const manifest = {
  counts: migration.counts,
  keep: KEEP_PATHS,
  rss: RSS_PATH,
  blogRssRedirect: '/blog/rss.xml',
  newGuidPolicy: 'Existing items keep the baseline guid string with isPermaLink=false. Items that are not in the baseline use tag:zhangwen.site,YYYY-MM-DD:collection:[series:]slug, also with isPermaLink=false, so a later path move does not change the guid.',
  www: 'Production only. Preview and local checks must not claim www was verified.',
  mappings: migration.mappings,
  guids: migration.guidRecords,
  contentLinksRewritten: changed,
  unresolvedContentLinks: unresolved,
}
fs.writeFileSync(path.join(root, 'scripts/baselines/migration-map.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(JSON.stringify({
  counts: migration.counts,
  rewritten: changed.length,
  unresolved: unresolved.length,
}, null, 2))
if (unresolved.length) {
  console.log(JSON.stringify(unresolved.slice(0, 30), null, 2))
}
