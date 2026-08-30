# Wen's Blog

[Wen's Blog](https://zhangwen.site) 是一个持续更新的中文个人博客，记录软件开发、AI Coding 与日常阅读中的观察和实践。

## 写什么

这里没有固定的选题边界，但内容大致围绕几条长期主线：

- **AI 与软件工程**：Coding Agent、Skills、上下文管理、评估、自动化，以及 AI 进入真实研发流程后带来的工程问题。
- **移动端与客户端开发**：iOS、Swift、Flutter、Dart、测试、架构和性能等实践记录。
- **开发工具与技术笔记**：从命令行、Git、Node.js 到系统配置，整理那些实际解决过问题的经验。
- **阅读、投资与生活思考**：读书笔记、投资观察和不定期的「摸鱼精选」。

文章从具体问题出发，尽量写清楚过程、依据和限制，而不是只给结论。最近的内容可以从 [全部文章](https://zhangwen.site/blog/) 浏览，也可以直接阅读：

- [我的 AI Coding 工作流：从 Context、Skills 到 Automation](https://zhangwen.site/ai-coding-workflow/)
- [AI Software Engineering Weekly](https://zhangwen.site/ai-software-engineering-weekly-2026-08-28/)
- [如何解决长期 AI Coding 产生的代码屎山？](https://zhangwen.site/ai-coding-created-a-code-mountain/)

## 阅读入口

- [博客首页](https://zhangwen.site/)：查看最新发布的文章。
- [文章归档](https://zhangwen.site/blog/)：按时间浏览全部内容。
- [标签页](https://zhangwen.site/tags/)：按主题筛选文章。
- [RSS](https://zhangwen.site/rss.xml)：通过阅读器订阅更新。
- [关于我](https://zhangwen.site/about/)：了解作者与这个站点。

## 这个仓库

本仓库保存博客源码和全部 MDX 文章。站点使用 Astro 构建并部署到 Netlify；如需提交勘误或改进文章，欢迎发起 Issue 或 Pull Request。

文章位于 `content/blog/`，每篇文章使用独立目录：

```text
content/blog/YYYY-MM-DD--slug/index.mdx
```

新建文章可运行：

```sh
pnpm assistant
```

脚本会收集标题、slug、摘要、日期和标签，并生成文章目录与 `index.mdx`。文章 frontmatter 需包含 `title`、`slug`、`description`、`date`、`lastUpdated` 和 `tags`；具体 schema 见 `src/content.config.ts`。

## 本地运行

请先安装 [pnpm](https://pnpm.io/)。

```sh
pnpm install
pnpm dev
```

常用命令：

```sh
pnpm build     # 生产构建，并生成全文搜索索引
pnpm preview   # 本地预览构建结果
pnpm lint      # 检查代码风格
pnpm lint:fix  # 自动修复可处理的问题
```

部署由 Netlify 使用 `pnpm build` 生成 `dist/` 后完成。
