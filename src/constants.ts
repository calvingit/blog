/**
 * Metadata for your site
 */
export const SITE: Record<string, string> = {
  // Base URL of your site, used in sitemap generation
  url: 'https://zhangwen.site',
  /**
   * Site-wide title
   */
  title: 'Calvin',
  /**
   * Fallback brand title. The homepage sets its own document title.
   */
  titleDefault: 'Calvin',
  /**
   * Fallback only. The homepage passes its own sentence and must not inherit this.
   * RSS reads `RSS_DESCRIPTION` and does not read this field.
   */
  description: 'Calvin 的技术博客，关注 AI Coding、Agent 软件工程，以及移动端与 Web 开发。',
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

/**
 * RSS channel description. The previous sentence named 张文; only that identity word changes.
 */
export const RSS_DESCRIPTION = 'Calvin 的技术博客，关注 AI Coding、Agent 软件工程，以及移动端与 Web 开发。'

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
          url: '/blog/weekly/ai/',
        },
        {
          title: 'Frontend & Mobile Engineering',
          url: '/blog/weekly/frontend/',
        },
        {
          title: '摸鱼精选',
          url: '/blog/weekly/reading/',
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
    {
      title: 'X',
      url: 'https://x.com/calvin_cheung0',
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
