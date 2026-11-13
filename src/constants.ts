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
   * Fallback meta description for pages that do not set their own.
   * The homepage and RSS channel use HOME_DESCRIPTION and BLOG_DESCRIPTION.
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

/**
 * Homepage meta description. The visible homepage stays in M1 (PR #8);
 * this sentence matches that page so previews without it still meet AC12-12.
 */
export const HOME_DESCRIPTION = '张文的个人介绍。十余年全栈工程师，从 C/C++ 到 iOS，再到 Flutter 与 AI Coding。'

/**
 * RSS channel description. Separate from the homepage introduction.
 * Wording is fixed by PRD v4.
 */
export const BLOG_DESCRIPTION = '张文的技术博客，关注 AI Coding、Agent 软件工程，以及移动端与 Web 开发。'

export const SKIP_NAV_ID = 'skip-to-content'

/**
 * Available "asides" that can be used in MDX files
 */
export const ASIDE_TYPES = ['note', 'tip', 'caution', 'danger'] as const
export type AsideType = (typeof ASIDE_TYPES)[number]
