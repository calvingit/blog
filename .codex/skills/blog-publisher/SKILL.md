---
name: blog-publisher
description: Publish a new article to the blog from a URL. Use when the user provides an article link and wants to create a new Chinese-language blog post summarizing it, following the Astro MDX conventions of the blog repo, and then commit and push the post to origin. Triggers on requests like "根据这个链接发布一篇文章", "把这篇文章整理发布到博客", or similar.
---

# blog Publisher

Publish a new post to the blog repo from a URL.
Read [references/blog-conventions.md](references/blog-conventions.md) before starting — it contains the frontmatter schema, valid tags, directory naming, writing style, validation checklist, and commit format.

## Workflow

### Step 0 — Resolve project root

Run the following to determine `$BLOG_ROOT` (all subsequent paths are relative to it):

```bash
git rev-parse --show-toplevel
```

If the command fails (not inside a git repo), stop and ask the user to navigate to the blog project directory first.

### Step 1 — Fetch the article

Fetch the user-provided URL and extract:

- Core thesis and motivation
- Key concepts and principles
- Practical takeaways or code examples worth preserving

Tool order and fallback:

1. If URL host is `weixin.qq.com` or `mp.weixin.qq.com`, use browser MCP (`chrome-devtools`) directly to extract visible page text and metadata (title/author/date)
2. If URL host is `x.com` or `twitter.com`, use `agent-browser` directly to extract visible page text and metadata (title/author/date/post stats if available)
3. For other non-WeChat/non-X sites, use `markdown.new` to fetch clean Markdown content:
   - POST to `https://markdown.new/` with body `{"url": "<target-url>", "method": "auto"}`
   - Or simply prepend: `https://markdown.new/<target-url>`
   - Prefer this over raw HTML fetch — returns structured Markdown with up to 80% fewer tokens
4. If `markdown.new` returns an error or empty content, fall back to `mcp__fetch__fetch`
5. If `markdown.new` and `mcp__fetch__fetch` both fail (for example due to robots/protection), fall back to `agent-browser` (same as WeChat handling) to extract visible page content
6. If all applicable methods fail, report the error and stop

WeChat-specific rule:

- Do **not** use `markdown.new` or `mcp__fetch__fetch` for `weixin.qq.com` / `mp.weixin.qq.com`; use `chrome-devtools` directly.

X/Twitter-specific rule:

- Do **not** stop after `markdown.new` / `mcp__fetch__fetch` failure on `x.com` / `twitter.com`; use `agent-browser` to continue extraction.

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
cd $BLOG_ROOT
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
cd $BLOG_ROOT
git status --short
git add content/blog/YYYY-MM-DD--{slug}/
git commit -m 'docs: add post "<title>"'
git push origin main
```

Use the commit format from blog-conventions.md.

Commit boundary rule:

- Only stage the new post directory unless the user explicitly asks to include other files.
