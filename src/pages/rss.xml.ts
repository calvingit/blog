import type { RSSFeedItem } from '@astrojs/rss'
import type { APIRoute } from 'astro'
import { getRssString } from '@astrojs/rss'
import { BLOG_DESCRIPTION, SITE } from '@constants'
import { getAllContentEntries, getContentUrl } from '@content'
import { sortAsc } from '@utils'
import legacyGuids from '../generated/legacy-guids.json'

const guids = legacyGuids as Record<string, string>

function generateContent(description: string, link: string) {
  return `<p>${description}</p><div style="margin-top: 50px; font-style: italic;"><strong><a href="${link}">Keep reading</a>.</strong></div>`
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export const GET: APIRoute = async () => {
  const entries = sortAsc(await getAllContentEntries())
  const items = entries.map((entry) => {
    const path = getContentUrl(entry)
    const link = new URL(path, SITE.url).href

    return {
      title: entry.data.title,
      description: entry.data.description,
      content: generateContent(entry.data.description, link),
      link,
      pubDate: entry.data.date,
      path,
    }
  })

  let xml = await getRssString({
    trailingSlash: true,
    title: SITE.titleDefault,
    description: BLOG_DESCRIPTION,
    site: new URL('/blog/', SITE.url).href,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    customData: `<atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"></atom:link><language>zh-Hans</language>`,
    items: items.map(({ title, description, content, link, pubDate }) => ({
      title,
      description,
      content,
      link,
      pubDate,
    } satisfies RSSFeedItem)),
  })

  for (const item of items) {
    const legacy = guids[item.path]
    const guid = legacy ?? item.link
    const perma = legacy ? 'false' : 'true'
    const from = `<guid isPermaLink="true">${escapeXml(item.link)}</guid>`
    const to = `<guid isPermaLink="${perma}">${escapeXml(guid)}</guid>`
    if (!xml.includes(from)) {
      throw new Error(`RSS guid for ${item.link} was not in the feed`)
    }
    xml = xml.replace(from, to)
  }

  if (!xml.includes(`<link>${SITE.url}/blog/</link>`)) {
    throw new Error('RSS channel link must be /blog/')
  }
  if (!xml.includes(`<description>${BLOG_DESCRIPTION}</description>`)) {
    throw new Error('RSS channel description mismatch')
  }
  if (!xml.includes('<language>zh-Hans</language>') || xml.includes('en-us')) {
    throw new Error('RSS language must be zh-Hans')
  }
  if (!xml.includes(`<atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"`)) {
    throw new Error('RSS atom:link rel=self is missing')
  }
  if (xml.includes('isPermaLink="true"') && Object.keys(guids).length === items.length) {
    throw new Error('Existing RSS items must keep legacy guids with isPermaLink=false')
  }

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
