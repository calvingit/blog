# Mini-Blog Conventions

## Repository

Path: `/Users/zhangwen/Workspace/mini-blog`
Package manager: `pnpm`
Remote: `origin` (GitHub)

## Directory & File Naming

Each post lives in its own directory:

```
content/blog/YYYY-MM-DD--slug/index.mdx
```

- `YYYY-MM-DD` = post date
- `slug` = kebab-case, SEO-friendly, no dots or spaces

## Frontmatter Schema

```yaml
---
title: 文章标题（中文）
slug: kebab-case-slug
description: 一两句摘要，用于 meta 标签和 RSS
date: YYYY-MM-DD
lastUpdated: YYYY-MM-DD
tags:
  - TagName
searchIndex: true # optional, defaults to true
image: https://... # optional, absolute URL only
---
```

## Valid Tags

Must be one of (use display name exactly):

- `Flutter`
- `Invest`
- `Others`
- `Softwares`
- `Thoughts`
- `Reading`
- `iOS`
- `Tutorial`
- `Tool`

Adding any tag not in this list will fail build-time schema validation.

## Writing Style

- Language: **Chinese** (Simplified)
- Perspective: Learner summarizing for other learners — focus on _why_ and _how_, not just _what_
- Structure: Lead with context/motivation, then core concepts, then practical takeaways
- Use `##` / `###` headings to organize; code blocks with language identifiers
- Asides (:::note / :::tip / :::caution / :::danger) for callouts
- Do NOT include the source URL in the article body

## MDX Notes

- Supported custom components: `<Aside>`, `<Playground>`
- Aside syntax: `:::note[Custom Title]` (title optional)
- External links open in new tab automatically (rehype plugin handles it)
- Heading anchors are auto-generated

## Validation Checklist

Before committing, verify:

1. Frontmatter has all required fields (title, slug, description, date, lastUpdated, tags)
2. Tag values match the valid list exactly (case-sensitive)
3. Directory name matches `YYYY-MM-DD--{slug}` where slug == frontmatter `slug`
4. File is `index.mdx`
5. No frontmatter fields outside the schema

## Commit Convention

Format: `docs: add post "<title>"`

Example:

```
docs: add post "Flutter 自定义 ScrollView 与 Sliver 系列组件高级实战"
```

Push command: `git push origin main`
