import { HOME_DESCRIPTION, SITE } from '@constants'

export interface Crumb {
  name: string
  path: string
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).href
}

export function websiteGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        'name': SITE.title,
        'url': `${SITE.url}/`,
        'description': HOME_DESCRIPTION,
        'inLanguage': SITE.lang,
        'publisher': { '@id': `${SITE.url}/#person` },
        'author': { '@id': `${SITE.url}/#person` },
      },
      {
        '@type': 'Person',
        '@id': `${SITE.url}/#person`,
        'name': '张文',
        'alternateName': 'Wen',
        'url': `${SITE.url}/about/`,
        'sameAs': [
          'https://github.com/calvingit',
          'https://x.com/calvin_cheung0',
        ],
      },
    ],
  }
}

export function blogPostingGraph(options: {
  title: string
  description: string
  date: Date
  lastUpdated: Date
  image?: string
  path: string
  crumbs: Crumb[]
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        'headline': options.title,
        'description': options.description,
        'author': {
          '@type': 'Person',
          'name': '张文',
          'url': `${SITE.url}/about/`,
        },
        'datePublished': options.date.toISOString(),
        'dateModified': options.lastUpdated.toISOString(),
        'mainEntityOfPage': absoluteUrl(options.path),
        'image': absoluteUrl(options.image || SITE.defaultOgImage),
        'inLanguage': SITE.lang,
      },
      breadcrumbList(options.crumbs),
    ],
  }
}

export function collectionGraph(options: {
  name: string
  description: string
  path: string
  crumbs: Crumb[]
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        'name': options.name,
        'description': options.description,
        'url': absoluteUrl(options.path),
        'inLanguage': SITE.lang,
        'isPartOf': `${SITE.url}/#website`,
      },
      breadcrumbList(options.crumbs),
    ],
  }
}

function breadcrumbList(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    'itemListElement': crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': crumb.name,
      'item': absoluteUrl(crumb.path),
    })),
  }
}
