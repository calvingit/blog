# AGENTS.md

This file provides guidance to AI Agent when working with code in this repository.

## Project Overview

Personal blog (https://zhangwen.site) built with [Astro](https://astro.build), customized from [astro-theme-minimal-blog](https://github.com/LekoArts/astro-theme-minimal-blog). Static output deployed to Netlify. Blog posts are written in MDX.

## Commands

**Package manager:** `pnpm` (required — do not use npm or yarn)

```sh
pnpm install          # Install dependencies
pnpm dev              # Start dev server (localhost:4321)
pnpm build            # Full production build: astro build + pagefind index
pnpm build:astro      # Astro build only (no search index)
pnpm build:pagefind   # Regenerate pagefind search index (requires dist/ to exist)
pnpm preview          # Preview production build locally
pnpm lint             # Run ESLint
pnpm lint:fix         # Auto-fix ESLint issues
pnpm assistant        # Interactive CLI to scaffold a new blog post
```

There are no automated tests in this project.

## Architecture

### Content

Blog posts live in `content/blog/` with the directory convention `YYYY-MM-DD--slug/index.mdx`. The content schema is defined in `src/content.config.ts` and enforces that every post has `title`, `slug`, `description`, `date`, `lastUpdated`, and `tags`. Tags must be pre-registered in `FRONTMATTER_TAGS` in `src/constants.ts` — adding a tag anywhere else will fail validation.

### Configuration hub: `src/constants.ts`

All site-wide settings live here: `SITE` (URL, title, description, lang), `HEADER` (nav links), `FRONTMATTER_TAGS` (allowed tag display-names → slugs), and `ASIDE_TYPES`. This is the first place to change when modifying site identity or navigation.

### Pages and routing

- `/` → `src/pages/index.astro` — homepage with recent posts
- `/blog/` → `src/pages/blog.astro` — all posts
- `/blog/[slug]/` → `src/pages/[blog].astro` — individual post (dynamic route using `slug` frontmatter field, **not** the file path)
- `/tags/` and `/tags/[tag]/` → `src/pages/tags/` — tag index and filtered post list
- `/about/` → `src/pages/about.astro`
- `/rss.xml` → `src/pages/rss.xml.ts`

### Markdown pipeline

`astro.config.ts` wires the full remark/rehype pipeline:

- **remark:** `remarkSmartypants`, `remarkDirective` + custom `remarkAsides` (`src/remark.ts`) transforms `:::note/tip/caution/danger` directives into `<Aside>` MDX components; `remarkSandpack` transforms fenced code blocks inside `<Playground>` into Sandpack components.
- **rehype:** `rehypeSlug`, `rehypeExternalLinks` (opens in new tab, adds sr-only label), `rehypeAutolinkHeadings`.

### Search (Pagefind)

Pagefind runs _after_ the Astro build (`pnpm build:pagefind`) and indexes `dist/`. In dev mode, a custom `pagefindIntegration()` (in `src/utils.ts`) serves the pagefind assets from `dist/` via a Vite middleware so search works during development without a separate server.

### TypeScript path aliases

Configured in `tsconfig.json`:
| Alias | Resolves to |
|---|---|
| `@constants` | `src/constants.ts` |
| `@utils` | `src/utils.ts` |
| `@components/*` | `src/components/*` |
| `@layouts/*` | `src/layouts/*` |
| `@assets/*` | `src/assets/*` |
| `@styles/*` | `src/styles/*` |

### Styling

Tailwind v4 via `@tailwindcss/vite`. The Tailwind Typography plugin (`@tailwindcss/typography`) is used for prose content. Light/dark theme is toggled via `data-theme="light|dark"` on `<html>` — Expressive Code (`ec.config.mjs`) reads this attribute to switch between `github-light` and `github-dark` themes.

### Code style (ESLint)

Uses `@antfu/eslint-config` with: 2-space indent, single quotes, no semicolons. Formatters and Astro/TypeScript rules enabled. Run `pnpm lint:fix` before committing.

## Adding a blog post

Use the interactive CLI: `pnpm assistant`. It prompts for title, slug, description, date, and tags, then creates `content/blog/YYYY-MM-DD--slug/index.mdx` with prefilled frontmatter. Extend the CLI at `scripts/assistant.ts` if needed.
