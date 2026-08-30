/**
 * Metadata for your site
 */
export const SITE: Record<string, string> = {
  // Base URL of your site, used in sitemap generation
  url: 'https://zhangwen.site',
  /**
   * Site-wide title
   */
  title: 'Wen\'s Blog',
  /**
   * Used on index page and as a fallback if no title is set
   */
  titleDefault: 'Wen\'s Blog',
  /**
   * Used in meta tags, RSS feed, and other places
   */
  description: 'Wen\'s Blog - Focus on Technology Sharing and Life Thoughts',
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
  defaultAuthor: 'Wen',
}

interface HeaderLink {
  title: string
  url: string
}

interface HeaderMenu {
  title: string
  links: HeaderLink[]
}

interface Header {
  internal: Array<HeaderLink | HeaderMenu>
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
      title: 'Home',
      url: '/',
    },
    {
      title: 'Blog',
      url: '/blog/',
    },
    {
      title: 'Weekly',
      links: [
        {
          title: 'AI Software Engineering',
          url: '/weekly/ai/',
        },
        {
          title: 'Frontend & Mobile Engineering',
          url: '/weekly/frontend/',
        },
        {
          title: '摸鱼精选',
          url: '/weekly/reading/',
        },
      ],
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
  ],
}

export const SKIP_NAV_ID = 'skip-to-content'

/**
 * Available "asides" that can be used in MDX files
 */
export const ASIDE_TYPES = ['note', 'tip', 'caution', 'danger'] as const
export type AsideType = (typeof ASIDE_TYPES)[number]
