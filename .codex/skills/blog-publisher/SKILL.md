---
name: blog-publisher
description: 从 URL 发布新文章到博客。当用户提供文章链接并希望整理成中文博客文章、保存发布到博客仓库时使用。触发词包括："根据这个链接发布一篇文章"、"把这篇文章整理发布到博客"、"帮我写成博客"、"发布新文章"、"发布到博客"等。技术类文章优先提炼原理、应用场景与工程实践。
---

# Blog Publisher

从 URL 抓取文章内容，整理成中文技术博客并发布到博客仓库。

发布前请先阅读 [references/blog-conventions.md](references/blog-conventions.md)，其中包含 frontmatter schema、有效 tags、目录命名规则、写作风格要求、校验清单与 commit 格式。

---

## 工作流程

### Step 0 — 确认项目根目录

```bash
git rev-parse --show-toplevel
```

如果命令失败（不在 git 仓库中），停止执行并提示用户先切换到博客项目目录。

---

### Step 1 — 抓取文章内容

抓取用户提供的 URL，提取以下内容：

- 文章核心论点与写作动机
- 关键概念、原理与技术细节
- 值得保留的实践经验、代码示例或工程建议

**抓取工具优先级与降级策略：**

| 优先级    | 适用场景                                                                  | 工具                                                                          |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1（直接） | `weixin.qq.com`、`mp.weixin.qq.com`、`medium.com`、`x.com`、`twitter.com` | `agent-browser`                                                               |
| 2（默认） | 其他网站                                                                  | `markdown.new` — `POST https://markdown.new/` 或 `https://markdown.new/<url>` |
| 3（降级） | `markdown.new` 返回空或报错                                               | `mcp__fetch__fetch`                                                           |
| 4（兜底） | 以上均失败                                                                | `agent-browser`                                                               |

所有方法均失败时，报告错误并停止。

**检测到未安装`agent-browser`时，自行安装并重试抓取**

```bash
npm install -g agent-browser
agent-browser install  # Download Chromium
```

---

### Step 2 — 撰写 MDX 博客文章

以**学习者视角**组织内容，优先回答「为什么重要」，再讲「是什么」，最后讲「怎么用」。不要直接翻译，要**重构与提炼**。

#### 2.1 技术文章写作结构（推荐）

```
1. 背景与动机     — 这个技术/问题是怎么出现的？解决什么痛点？
2. 核心原理       — 关键概念与机制，配合示意图或代码片段
3. 工程实践       — 如何在实际项目中落地，注意事项与坑
4. 延展思考       — 与其他技术的对比 / 适用边界 / 未来趋势
5. 参考资源       — 原文链接 + 延伸阅读（可选）
```

> ⚠️ 不是所有文章都需要五节。根据原文内容灵活取舍，保持结构清晰即可。

#### 2.2 frontmatter 与文件操作

1. 读取 `src/constants.ts`，以 `FRONTMATTER_TAGS` 作为 tags 的唯一来源
2. 从主题推导简洁的 kebab-case `slug`（英文优先）
3. 使用今天的日期作为 `date` 和 `lastUpdated`
4. 检查 `content/blog/YYYY-MM-DD--{slug}` 是否已存在：
   - 不存在 → 新建
   - 存在且为空 → 复用
   - 存在且非空 → 追加后缀（如 `-2`）避免冲突
5. 创建文件：`content/blog/YYYY-MM-DD--{slug}/index.mdx`
6. 正文使用**简体中文**
7. 正文开头（紧接 frontmatter 之后）插入引用说明块：

```mdx
:::note[引用说明]
本文基于 <作者名> 的文章整理与延展：[<标题>](<URL>)。
:::
```

---

### Step 2.5 — 内容润色（humanizer-zh）

在校验之前，调用 `humanizer-zh` 对正文（不含 frontmatter）进行润色，减少 AI 写作痕迹。

润色要求：

- 保持所有事实、链接、人名、日期、数字、代码片段和技术术语不变（除非明显有误）
- 保留「为什么 → 是什么 → 怎么用」的学习者结构，不删除引用说明块
- 优先使用自然、简洁的中文，避免模板化表达
- 润色后进行 diff 检查，确保未引入新的不可核实的说法
- 如果 `humanizer-zh` 不可用，保留原文继续执行，不阻塞发布

---

### Step 3 — 校验

执行 blog-conventions.md 中的校验清单，并运行构建：

```bash
cd $BLOG_ROOT
pnpm build:astro
```

**校验门控：**

- [ ] 所有必填 frontmatter 字段均已填写
- [ ] tags 值与 `src/constants.ts` 完全一致（区分大小写）
- [ ] 目录名格式为 `YYYY-MM-DD--{slug}`
- [ ] 文件名为 `index.mdx`
- [ ] 无 schema 之外的 frontmatter 字段

发现问题先修复，再继续。

---

### Step 4 — 提交并推送

```bash
cd $BLOG_ROOT
git status --short
git add content/blog/YYYY-MM-DD--{slug}/
git commit -m 'docs: add post "<文章标题>"'
git push origin main
```

commit 格式遵循 blog-conventions.md 的规定。

**提交边界：** 除非用户明确要求，只暂存新建的文章目录，不包含其他文件。

---

## 技术文章写作原则

| 原则           | 说明                                           |
| -------------- | ---------------------------------------------- |
| 学习者优先     | 先讲动机与背景，再进入细节，降低认知门槛       |
| 不翻译，要重构 | 用自己的语言重新组织，不做逐字翻译             |
| 代码要可运行   | 保留原文代码时注意版本与依赖说明               |
| 观点要有增量   | 「延展思考」部分需有真正新的洞见，不是简单复述 |
| 来源透明       | 始终保留引用说明，标注原作者与原文链接         |
