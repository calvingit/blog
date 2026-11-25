import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Run after pnpm build: node scripts/check-home-row-padding.mjs
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')

function rowClasses(heading) {
  const section = html.match(new RegExp(`<section\\b[^>]*aria-labelledby="${heading}"[^>]*>([\\s\\S]*?)</section>`))?.[1]
  assert.ok(section, `Missing ${heading} section in dist/index.html; run pnpm build first`)

  return [...section.matchAll(/<a\b[^>]*\sclass="([^"]*)"[^>]*>/g)]
    .map(match => match[1].split(/\s+/))
    .filter(classes => classes.includes('home-row'))
}

const articles = rowClasses('featured-heading')
assert.ok(articles.length >= 2, 'Need first and later featured rows to check padding consistency')
for (const [index, classes] of articles.entries()) {
  // Reject additional overrides too, including first:pt-0 and md:pt-0.
  const padding = classes.filter(value => /(?:^|:)!?p[trblxyse]?-/.test(value)).sort()
  assert.deepEqual(padding, ['px-3', 'py-5'], `Featured row ${index + 1} must have symmetric, consistent padding`)
}

const projects = rowClasses('projects-heading')
assert.ok(projects.length > 0, 'Missing project rows')
for (const [index, classes] of projects.entries()) {
  assert.ok(classes.includes('px-3'), `Project row ${index + 1} must retain px-3`)
}

console.log(`Homepage padding check passed: ${articles.length} featured rows and ${projects.length} project rows`)
