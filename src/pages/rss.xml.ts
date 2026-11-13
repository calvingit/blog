import type { RSSFeedItem } from '@astrojs/rss'
import type { APIRoute } from 'astro'
import rss from '@astrojs/rss'
import { RSS_DESCRIPTION, SITE } from '@constants'
import { getAllContentEntries, getContentUrl } from '@content'
import { sortAsc } from '@utils'
import { baselineGuidForOldPath, oldContentPath, stableGuid } from '../../scripts/migration/lib.mjs'

function generateContent(description: string, link: string) {
  return `<p>${description}</p><div style="margin-top: 50px; font-style: italic;"><strong><a href="${SITE.url}${link}">Keep reading</a>.</strong></div>`
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const GET: APIRoute = async () => {
  const entries = sortAsc(await getAllContentEntries())
  const guids = entries.map((entry) => {
    const oldPath = oldContentPath(entry)
    return baselineGuidForOldPath(oldPath) ?? stableGuid({
      date: entry.data.date.toISOString().slice(0, 10),
      collection: entry.collection,
      series: entry.collection === 'weekly' ? entry.data.series : undefined,
      slug: entry.data.slug,
    })
  })

  const items = entries.map((entry) => {
    const link = getContentUrl(entry)

    return {
      title: entry.data.title,
      description: entry.data.description,
      content: generateContent(entry.data.description, link),
      link: new URL(link, SITE.url).href,
      pubDate: entry.data.date,
    } satisfies RSSFeedItem
  })

  const response = await rss({
    trailingSlash: true,
    title: SITE.titleDefault,
    description: RSS_DESCRIPTION,
    site: `${SITE.url}/blog/`,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    items,
    customData: '<language>zh-Hans</language><atom:link href="https://zhangwen.site/rss.xml" rel="self" type="application/rss+xml"/>',
  })

  let xml = await response.text()
  let index = 0
  xml = xml.replace(/<guid isPermaLink="true">[^<]*<\/guid>/g, () => {
    const guid = guids[index++]
    if (!guid)
      throw new Error('RSS guid replacement ran out of entries')
    return `<guid isPermaLink="false">${escapeXml(guid)}</guid>`
  })
  if (index !== guids.length)
    throw new Error(`RSS guid replacement count ${index} did not match ${guids.length} entries`)

  return new Response(xml, {
    headers: response.headers,
  })
}
