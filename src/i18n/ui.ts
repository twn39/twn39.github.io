export const languages = {
  zh: '简体中文',
  en: 'English',
} as const;

export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'zh';

export const ui = {
  zh: {
    'site.name': 'BitesBytes Lab',
    'site.subtitle': '独立开发 · 技术分享',
    'site.tagline': '聚焦独立开发、开源工具与硬核技术分享',
    'site.description':
      'BitesBytes Lab —— 聚焦独立开发与技术分享，记录开源工具、原生应用架构与一线工程实践。',
    'nav.overview': '概览',
    'nav.projects': '开源项目',
    'nav.closed_projects': '闭源项目',
    'nav.blog': '技术博客',
    'nav.llms': 'llms.txt',
    'nav.search': '检索',
    'nav.theme': '切换主题',
    'hero.eyebrow': '独立开发实验室 · 开源项目与技术分享',
    'hero.headline': '独立开发，打磨好用的软件与硬核技术。',
    'hero.subheadline':
      '聚焦独立开发与深度技术分享：从开源底层库、跨平台工具到 App Store 原生应用，记录真实的架构权衡、性能优化与工程实践。',
    'hero.cta.projects': '浏览开源项目',
    'hero.cta.blog': '阅读技术长文',
    'hero.cta.github': 'GitHub 主页',
    'section.profile': 'GitHub 提交日历 · Contributions',
    'section.projects': '核心开源仓库 · Open Source',
    'section.projects.note': 'code + architecture notes',
    'section.closed_projects': '闭源商业应用 · App Store',
    'section.closed_projects.note': 'iOS · macOS · architecture notes',
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
    'closed.title': '闭源应用矩阵 · App Store',
    'closed.subtitle': '独立设计与研发的 iOS / macOS 原生应用，均已上架 Apple App Store。源码虽闭源，核心图形学、并发模型与底层算法细节均在技术博客中公开复盘。',
    'closed.filter.all': '全部应用',
    'closed.badge': 'App Store',
    'closed.appstore_download': '前往 App Store 下载',
    'closed.mac_appstore_download': '前往 Mac App Store 下载',
    'closed.delivery': '支持平台',
    'closed.sla': 'Bundle ID',
    'closed.scale': '核心技术栈',
    'closed.arch_spec': '工程架构规格 · Technical Spec',
    'closed.related_posts': '对应技术拆解博客',
    'closed.no_posts': '架构复盘整理中',
    'apps.back_to_list': '返回闭源应用矩阵',
    'apps.overview': '产品概览与核心特性',
    'apps.faq': '常见问题 · FAQ',
    'apps.support': '技术支持与隐私声明 · Support & Privacy',
    'apps.support_desc': '如需反馈问题、提交功能建议或查阅隐私说明，请通过 GitHub 主页联系开发者或参考 Apple App Store 产品页的官方隐私标签。',
    'apps.view_detail': '产品详情页 →',
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
    'site.name': 'BitesBytes Lab',
    'site.subtitle': 'Indie Dev & Tech',
    'site.tagline': 'Focused on indie development, open-source craft & technical sharing',
    'site.description':
      'BitesBytes Lab — Focused on indie development and technical sharing, featuring open-source libraries, native apps, and hands-on engineering essays.',
    'nav.overview': 'Overview',
    'nav.projects': 'Open Source',
    'nav.closed_projects': 'Closed Source',
    'nav.blog': 'Blog',
    'nav.llms': 'llms.txt',
    'nav.search': 'Search',
    'nav.theme': 'Toggle Theme',
    'hero.eyebrow': 'Indie Dev Lab · Open Source & Technical Sharing',
    'hero.headline': 'Indie craft, engineered in bites and bytes.',
    'hero.subheadline':
      'Focused on independent software development and practical technical sharing—from open-source libraries and developer tools to native App Store apps, with honest architecture notes and benchmarks.',
    'hero.cta.projects': 'Explore Projects',
    'hero.cta.blog': 'Read Essays',
    'hero.cta.github': 'GitHub Org',
    'section.profile': 'GitHub Contributions · Commit Calendar',
    'section.projects': 'Open Source Repositories · GitHub',
    'section.projects.note': 'code + architecture notes',
    'section.closed_projects': 'Proprietary Apps · App Store',
    'section.closed_projects.note': 'iOS · macOS · architecture notes',
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
    'closed.title': 'Closed-Source Apps · App Store',
    'closed.subtitle': 'Native iOS and macOS applications shipped on the Apple App Store. While source code is proprietary, their GPU pipelines, C++ interop, and local-first architectures are documented openly in our essays.',
    'closed.filter.all': 'All Apps',
    'closed.badge': 'App Store',
    'closed.appstore_download': 'Download on the App Store',
    'closed.mac_appstore_download': 'Download on Mac App Store',
    'closed.delivery': 'Platform',
    'closed.sla': 'Bundle ID',
    'closed.scale': 'Core Tech Stack',
    'closed.arch_spec': 'Architecture Spec · Technical Profile',
    'closed.related_posts': 'Public Architecture Essays',
    'closed.no_posts': 'Architecture notes in preparation',
    'apps.back_to_list': 'Back to Closed-Source Apps',
    'apps.overview': 'Overview & Capabilities',
    'apps.faq': 'Frequently Asked Questions',
    'apps.support': 'Support & Privacy · App Store Compliance',
    'apps.support_desc': 'For troubleshooting, feature requests, or privacy inquiries, please reach out via the developer GitHub profile or consult the official App Privacy label on the Apple App Store product page.',
    'apps.view_detail': 'Product Page →',
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
