# Weekly 栏目约定

适用于 `content/weekly/` 下的 ai 与 frontend 两个系列。通用写作规范见 [writing-style.md](./writing-style.md)，此处只维护这两个栏目特有的命名与标题规则。

## 命名

两个系列统一使用 weekly，不使用 newsletter。栏目名称以 `src/content.ts` 的 `WEEKLY_SERIES` 为准。

- 目录：`content/weekly/{series}/YYYY-MM-DD--{slug}/index.mdx`
- frontmatter `series`：`ai` 或 `frontend`
- slug：`ai-software-engineering-weekly-YYYY-MM-DD` 或 `frontend-mobile-engineering-weekly-YYYY-MM-DD`

## 标题

格式为「栏目名：本期看点」，如 `AI Software Engineering Weekly：GitHub 为 Agent 并发开发改造 Git 架构`。

- 日期不写进标题，列表页和 RSS 已单独展示日期，写进标题只是重复
- 只讲本期最值得点开的一件事，最多两件；标题里的事实必须出自本期条目
- 不与相邻各期共用同一条新闻做标题，选取前先比对上一期

## slug 稳定性

文章 URL 由 slug 决定，形式为 `/weekly/{series}/{slug}/`。站点当前没有 redirects 配置，改 slug 等于让旧链接失效，因此 slug 一经确定不再修改；确需调整时先补跳转规则。
