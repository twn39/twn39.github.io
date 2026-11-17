export const languages = {
  zh: '简体中文',
  en: 'English',
} as const;

export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'zh';

export const ui = {
  zh: {
    'site.name': 'Espresso',
    'site.subtitle': '浓缩工程志',
    'site.tagline': '高萃度系统架构、边缘运行时与极简工程美学笔记',
    'site.description':
      'Espresso 开源技术实验室与工程博客 —— 专注 Rust/Wasm 边缘运行时、LSM-Tree 存储引擎与 AI 原生文档工程。',
    'nav.overview': '概览',
    'nav.projects': '开源项目',
    'nav.closed_projects': '闭源项目',
    'nav.blog': '技术博客',
    'nav.llms': 'llms.txt',
    'nav.search': '检索',
    'nav.theme': '切换主题',
    'hero.eyebrow': 'GitHub 开源实验室 · 系统架构与底层实现笔记',
    'hero.headline': '浓缩技术本质，剔除冗余噪音。',
    'hero.subheadline':
      '像萃取一杯双份意式浓缩一样构建软件：克制的抽象、可验证的性能指标、清晰到像素级的 1px 工程蓝图。这里记录我们的 GitHub 开源项目与底层实现长文。',
    'hero.cta.projects': '浏览开源项目',
    'hero.cta.blog': '阅读技术长文',
    'hero.cta.github': 'GitHub 主页',
    'section.profile': 'GitHub 提交日历 · Contributions',
    'section.projects': '核心开源仓库 · Repositories',
    'section.projects.note': 'code + architecture notes',
    'section.blog': '最新技术长文 · Technical Essays',
    'section.blog.note': 'illustrated · with toc',
    'section.activity': '开源脉搏 · GitHub Activity & Quick Clone',
    'section.activity.note': '52 weeks · verifiable',
    'section.ai_index': 'AI 搜索与上下文索引 · GEO & LLM Index',
    'section.ai_index.note': 'llmstxt.org compliant',
    'section.faq': '工程原则 · Engineering Principles',
    'projects.title': '开源项目矩阵',
    'projects.subtitle': '每个仓库均配有架构设计文档与对应的深度技术拆解博客，代码与思想双向溯源。',
    'projects.filter.all': '全部仓库',
    'projects.related_posts': '对应技术博客',
    'projects.no_posts': '架构笔记撰写中',
    'projects.view_repo': '源码仓库',
    'projects.view_demo': '在线预览',
    'projects.stars': 'Stars',
    'projects.forks': 'Forks',
    'projects.license': '协议',
    'projects.latest': '版本',
    'closed.title': '闭源与商业系统矩阵',
    'closed.subtitle': '核心商业控制面、企业级加速内核与内部工程平台。源码虽不公开，但关键架构权衡与性能指标均在公开技术博客中持续复盘。',
    'closed.filter.all': '全部系统',
    'closed.badge': '闭源系统',
    'closed.delivery': '交付形态',
    'closed.sla': '核心指标',
    'closed.scale': '生产规模',
    'closed.arch_spec': '系统架构规格 · System Spec',
    'closed.related_posts': '公开架构拆解文章',
    'closed.no_posts': '架构复盘整理中',
    'blog.title': '技术博客归档',
    'blog.subtitle': '图文并茂的系统拆解、基准测试与前端工程实践。支持右侧目录缩略图导航与单篇 Markdown 导出。',
    'blog.filter.all': '全部文章',
    'blog.filter.by_project': '按关联项目筛选',
    'blog.read_time': '分钟阅读',
    'blog.published': '发布于',
    'blog.updated': '更新于',
    'blog.related_project': '关联项目',
    'blog.toc': '文章目录',
    'blog.toc.minimap': '章节缩略图',
    'blog.toc.progress': '阅读进度',
    'blog.copy_llm': '复制全文 Markdown (供 AI 阅读)',
    'blog.copied_llm': '已复制 Markdown 全文',
    'blog.raw_md': '原始 .md 索引',
    'blog.back_to_list': '返回博客列表',
    'blog.prev_post': '上一篇',
    'blog.next_post': '下一篇',
    'blog.figure.hint': '点击图表打开蓝图灯箱查看高清细节',
    'search.placeholder': '搜索项目名称、技术文章标题或标签...',
    'search.empty': '未找到匹配的项目或技术文章',
    'search.esc': 'ESC 关闭',
    'footer.rights': 'MIT & CC BY 4.0',
  },
  en: {
    'site.name': 'Espresso',
    'site.subtitle': 'Engineering Lab',
    'site.tagline': 'High-extraction systems architecture, edge runtimes & minimalist craft',
    'site.description':
      'Espresso Open Source Lab & Technical Blog — Focused on Rust/Wasm edge runtimes, LSM-Tree storage engines, and AI-native documentation.',
    'nav.overview': 'Overview',
    'nav.projects': 'Open Source',
    'nav.closed_projects': 'Closed Source',
    'nav.blog': 'Blog',
    'nav.llms': 'llms.txt',
    'nav.search': 'Search',
    'nav.theme': 'Toggle Theme',
    'hero.eyebrow': 'GitHub Open Source Lab · Architecture & Systems Essays',
    'hero.headline': 'High-extraction engineering. Zero filler.',
    'hero.subheadline':
      'We build software the way a double ristretto is pulled: restrained abstractions, reproducible benchmarks, and pixel-crisp 1px CAD blueprints. Home to our GitHub repositories and deep-dive architecture essays.',
    'hero.cta.projects': 'Explore Projects',
    'hero.cta.blog': 'Read Essays',
    'hero.cta.github': 'GitHub Org',
    'section.profile': 'GitHub Contributions · Commit Calendar',
    'section.projects': 'Featured Repositories · Open Source',
    'section.projects.note': 'code + architecture notes',
    'section.blog': 'Technical Essays · Deep Dives',
    'section.blog.note': 'illustrated · with toc',
    'section.activity': 'Open Source Pulse · GitHub Activity & Clone',
    'section.activity.note': '52 weeks · verifiable',
    'section.ai_index': 'AI Search & Context Index · GEO & llms.txt',
    'section.ai_index.note': 'llmstxt.org compliant',
    'section.faq': 'Engineering Principles · Philosophy',
    'projects.title': 'Open Source Repositories',
    'projects.subtitle': 'Every repository pairs production source code with illustrated architecture essays for bidirectional traceability.',
    'projects.filter.all': 'All Repos',
    'projects.related_posts': 'Technical Blog Posts',
    'projects.no_posts': 'Architecture notes in progress',
    'projects.view_repo': 'Repository',
    'projects.view_demo': 'Live Spec',
    'projects.stars': 'Stars',
    'projects.forks': 'Forks',
    'projects.license': 'License',
    'projects.latest': 'Release',
    'closed.title': 'Closed-Source & Proprietary Systems',
    'closed.subtitle': 'Commercial control planes, enterprise acceleration kernels, and internal engineering platforms—documented publicly through deep-dive architecture essays.',
    'closed.filter.all': 'All Systems',
    'closed.badge': 'Proprietary',
    'closed.delivery': 'Delivery',
    'closed.sla': 'Key Metric',
    'closed.scale': 'Production Scale',
    'closed.arch_spec': 'Architecture Spec · System Profile',
    'closed.related_posts': 'Public Architecture Essays',
    'closed.no_posts': 'Architecture notes in preparation',
    'blog.title': 'Technical Blog Archive',
    'blog.subtitle': 'Illustrated systems deep-dives, reproducible benchmarks, and frontend architecture notes with interactive TOC minimap & raw Markdown endpoints.',
    'blog.filter.all': 'All Essays',
    'blog.filter.by_project': 'Filter by Project',
    'blog.read_time': 'min read',
    'blog.published': 'Published',
    'blog.updated': 'Updated',
    'blog.related_project': 'Project',
    'blog.toc': 'On This Page',
    'blog.toc.minimap': 'TOC Minimap',
    'blog.toc.progress': 'Progress',
    'blog.copy_llm': 'Copy Markdown for LLM',
    'blog.copied_llm': 'Markdown Copied!',
    'blog.raw_md': 'Raw .md Endpoint',
    'blog.back_to_list': 'Back to Blog',
    'blog.prev_post': 'Previous',
    'blog.next_post': 'Next',
    'blog.figure.hint': 'Click any diagram to inspect in full-resolution Blueprint Lightbox',
    'search.placeholder': 'Search repositories, technical essays, or tags...',
    'search.empty': 'No matching projects or essays found',
    'search.esc': 'ESC to close',
    'footer.rights': 'MIT & CC BY 4.0',
  },
} as const;

export function getLangFromUrl(url: URL): Lang {
  const [, firstSegment] = url.pathname.split('/');
  if (firstSegment === 'en') return 'en';
  return 'zh';
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

export function localizePath(path: string, lang: Lang): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const stripped = normalized.replace(/^\/en(\/|$)/, '/');
  if (lang === 'zh') {
    return stripped === '' ? '/' : stripped;
  }
  if (stripped === '/') return '/en/';
  return `/en${stripped}`;
}

export function switchLocalePath(pathname: string, targetLang: Lang): string {
  return localizePath(pathname, targetLang);
}

export function formatDate(date: Date, lang: Lang): string {
  if (lang === 'zh') {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
