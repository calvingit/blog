---
name: mini-blog-publisher
description: Publish a new article to the mini-blog (zhangwen.site) from a URL. Use when the user provides an article link and wants to create a new Chinese-language blog post summarizing it, following the Astro MDX conventions of the mini-blog repo, and then commit and push the post to origin. Triggers on requests like "根据这个链接发布一篇文章", "把这篇文章整理发布到博客", or similar.
---

# Mini-Blog Publisher

Publish a new post to `/Users/zhangwen/Workspace/mini-blog` from a URL.
Read [references/blog-conventions.md](references/blog-conventions.md) before starting — it contains the frontmatter schema, valid tags, directory naming, writing style, validation checklist, and commit format.

## Workflow

### Step 1 — Fetch the article

Fetch the user-provided URL and extract:

- Core thesis and motivation
- Key concepts and principles
- Practical takeaways or code examples worth preserving

Tool order and fallback:

1. Prefer `mcp__fetch__fetch` for direct page content
2. If that fails, use web search/open tools to recover content
3. If both fail, report the error and stop

Do not continue with guessed content.

### Step 2 — Write the MDX post

From a **learner's perspective**: explain _why_ something matters before _what_ it is, and _how_ to apply it. Do not just translate — synthesize and restructure for clarity.

1. Read `src/constants.ts` and use `FRONTMATTER_TAGS` as the source of truth for tags
2. Derive a concise kebab-case `slug` from the topic (English preferred)
3. Use today's date as both `date` and `lastUpdated`
4. Check if `content/blog/YYYY-MM-DD--{slug}` already exists:
   - If not exists: create it
   - If exists and empty: reuse it
   - If exists and not empty: create a non-conflicting slug (for example `-2`) and use that directory
5. Create `content/blog/YYYY-MM-DD--{slug}/index.mdx`
6. Write the post body in **Simplified Chinese**
7. At the beginning of the body (immediately after frontmatter), add a citation block with:
   - Original author name
   - Original article link

Citation template:

```mdx
:::note[引用说明]
本文基于 <Author> 的文章整理与延展：[<Title>](<URL>)。
:::
```

### Step 3 — Validate

Run the validation checklist from blog-conventions.md and execute:

```bash
cd /Users/zhangwen/Workspace/mini-blog
pnpm build:astro
```

Validation gates:

- All required frontmatter fields present
- Tag values match `src/constants.ts` exactly (case-sensitive)
- Directory name matches `YYYY-MM-DD--{slug}`
- File is `index.mdx`
- No frontmatter fields outside schema

Fix any issues before proceeding.

### Step 4 — Commit and push

```bash
cd /Users/zhangwen/Workspace/mini-blog
git status --short
git add content/blog/YYYY-MM-DD--{slug}/
git commit -m 'docs: add post "<title>"'
git push origin main
```

Use the commit format from blog-conventions.md.

Commit boundary rule:

- Only stage the new post directory unless the user explicitly asks to include other files.
