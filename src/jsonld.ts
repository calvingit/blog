import { SITE } from '@constants'

const PERSON_ID = 'https://zhangwen.site/#person'

export function homeGraph(description: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        'name': 'Calvin',
        'url': 'https://zhangwen.site/',
        description,
        'inLanguage': 'zh-Hans',
        'author': { '@id': PERSON_ID },
        'publisher': { '@id': PERSON_ID },
      },
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        'name': 'Calvin',
        'url': 'https://zhangwen.site/about/',
        'sameAs': [
          'https://github.com/calvingit',
          'https://x.com/calvin_cheung0',
        ],
      },
    ],
  }
}

export function blogPosting(input: {
  headline: string
  description: string
  datePublished: string
  dateModified: string
  pageUrl: string
  image?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': input.headline,
    'description': input.description,
    'inLanguage': 'zh-Hans',
    'datePublished': input.datePublished,
    'dateModified': input.dateModified,
    'mainEntityOfPage': input.pageUrl,
    'image': new URL(input.image || SITE.defaultOgImage, SITE.url).href,
    'author': {
      '@type': 'Person',
      'name': 'Calvin',
      'url': 'https://zhangwen.site/about/',
    },
  }
}
