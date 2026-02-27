type MapKey<T extends Map<any, any>> = T extends Map<infer K, any> ? K : never

/**
 * Metadata for your site
 */
export const SITE: Record<string, string> = {
  // Base URL of your site, used in sitemap generation
  url: 'https://zhangwen.site',
  /**
   * Site-wide title
   */
  title: 'Calvin\'s Blog',
  /**
   * Used on index page and as a fallback if no title is set
   */
  titleDefault: 'Calvin\'s Blog',
  /**
   * Used in meta tags, RSS feed, and other places
   */
  description: 'Calvin\'s Blog - Focus on Technology Sharing and Life Thoughts',
  /**
   * Language used in the <html> tag
   */
  lang: 'zh-Hans',
  /**
   * Name of the image inside `public` folder that should be used as a default og:image
   */
  defaultOgImage: '/og-image.png',
  /**
   * Default author name that gets added to meta tags
   */
  defaultAuthor: 'Calvin',
}

interface Header {
  internal: Array<{ title: string, url: string }>
  external: Array<{
    title: string
    url: string
    props?: Record<string, unknown>
  }>
}

/**
 * Links used in the header
 */
export const HEADER: Header = {
  /**
   * Internal links to other subpages shown in the header navigation
   */
  internal: [
    {
      title: 'Blog',
      url: '/blog/',
    },
    {
      title: 'Reading',
      url: '/tags/reading/',
    },
    {
      title: 'About',
      url: '/about/',
    },
  ],
  /**
   * Arbitrary list of links (e.g. social media) shown on the right side of the header
   */
  external: [
    {
      title: 'GitHub',
      url: 'https://github.com/calvingit',
      props: {
        target: '_blank',
      },
    },
    {
      title: 'Twitter',
      url: 'https://twitter.com/zhangwen_site',
      props: {
        target: '_blank',
      },
    },
  ],
}

/**
 * A map of name - slug pairs
 */
export const FRONTMATTER_TAGS = new Map([
  ['Flutter', 'flutter'] as const,
  ['Invest', 'invest'] as const,
  ['Others', 'others'] as const,
  ['Softwares', 'softwares'] as const,
  ['Thoughts', 'thoughts'] as const,
  ['Reading', 'reading'] as const,
  ['iOS', 'ios'] as const,
])

export type FrontmatterTag = MapKey<typeof FRONTMATTER_TAGS>

export const SKIP_NAV_ID = 'skip-to-content'

/**
 * Available "asides" that can be used in MDX files
 */
export const ASIDE_TYPES = ['note', 'tip', 'caution', 'danger'] as const
export type AsideType = (typeof ASIDE_TYPES)[number]
