# Espresso · 浓缩工程志 ☕️📐

> 基于 **Astro 7.4 + Tailwind CSS v4** 与 **Blueprint UI 组件体系** 构建的极简主义 GitHub 开源实验室与双语技术博客。

## 核心特性 (Features)

- **简约不简单的 1px 工程蓝图美学**：贯穿视口的 `1px` 屏幕辅助线（`.screen-line-top` / `.screen-line-bottom`）、交点十字准星（`+`）、315° 斜纹分隔带与零闪烁明暗主题切换。
- **开源项目 × 技术博客双向联动**：
  - 展示 GitHub 开源仓库矩阵（语言占比条、Stars/Forks、快速克隆命令 `DaiCommandBlock`、鼠标跟随径向聚光灯卡片 `DaiGlowCardGrid` 与 52×7 GitHub 贡献热力图 `DaiGitHubGraph`）。
  - 每个开源项目直接列出对应的深度技术拆解文章；每篇博客右侧与顶部同步挂载所属项目卡片。
- **图文混排与交互式目录缩略图 (`DaiTocMinimap` + `DaiLightbox`)**：
  - 支持矢量架构图、基准测试图与表格代码混排，点击任意配图打开高清蓝图灯箱检视器。
  - 桌面端右侧悬浮 **TOC Minimap 代码缩略图刻度 + 章节大纲 + 实时阅读百分比**，移动端自适应折叠目录。
- **完整中英双语 (`zh-CN` / `en`)**：基于 Astro 原生 `i18n` 路由（`/` 与 `/en/`），顶栏语言切换器支持精准跳往当前文章的对应译本。
- **原生 AI 搜索与 Agent 索引 (`llms.txt`)**：
  - `/llms.txt`：遵循 [llmstxt.org](https://llmstxt.org) 规范的结构化导航索引。
  - `/llms-full.txt`：全站开源仓库与双语技术长文的单文件全量语料库。
  - `/blog/[slug].md` 与 `/en/blog/[slug].md`：单篇零 HTML 噪音的纯净 Markdown 端点，配合文章页一键「复制全文 Markdown (供 AI 阅读)」按钮。
  - `/robots.txt`：显式支持 `ClaudeBot`、`GPTBot`、`OAI-SearchBot`、`PerplexityBot` 等 AI 检索爬虫。

## 快速启动 (Quick Start)

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (http://localhost:4321)
pnpm dev

# 构建静态生产产物 (输出至 dist/，直接适配 GitHub Pages)
pnpm build

# 本地预览生产构建结果
pnpm preview
```

## 路由与 AI 索引端点结构

| 路径 | 说明 |
| :--- | :--- |
| `/` , `/en/` | 中 / 英双语实验室概览首页（含 GitHub 提交日历、项目矩阵、精选博客） |
| `/projects/` , `/en/projects/` | 开源仓库详情列表（支持按主语言筛选与对应技术文章跳转） |
| `/closed-source/` , `/en/closed-source/` | 闭源与商业系统矩阵（支持按交付形态筛选、系统架构规格与公开技术文章关联） |
| `/blog/` , `/en/blog/` | 技术博客归档（支持按关联开源/闭源项目筛选） |
| `/blog/[slug]/` , `/en/blog/[slug]/` | 图文技术长文详情页（含 TOC Minimap 目录、蓝图灯箱、代码复制） |
| `/blog/[slug].md` , `/en/blog/[slug].md` | 供 AI Agent 读取的单篇纯净 Markdown 端点 |
| `/llms.txt` , `/llms-full.txt` | AI 搜索引擎与大语言模型结构化索引清单及全量语料库 |
| `/rss.xml` , `/robots.txt` | RSS 2.0 订阅源与 AI 爬虫索引策略 |
