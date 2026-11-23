import type { CollectionEntry } from 'astro:content';
import {
  CLOSED_SOURCE_PROJECTS,
  ESPRESSO_PROJECTS,
  type EspressoClosedProject,
} from '../data/projects';
import { localizePath, useTranslations, type Lang } from '../i18n/ui';

export function formatOpenSourceProjectsMarkdown(
  origin: string,
  lang: Lang,
  posts: CollectionEntry<'blog'>[]
): string {
  const t = useTranslations(lang);
  const altLang: Lang = lang === 'zh' ? 'en' : 'zh';
  const canonicalUrl = `${origin}${localizePath('/projects/', lang)}`;
  const altMdUrl = `${origin}${localizePath('/projects.md', altLang)}`;

  const lines: string[] = [
    `# ${t('projects.title')} — ${t('site.name')}`,
    ``,
    `> ${t('projects.subtitle')}`,
    ``,
    `- Language: ${lang === 'zh' ? 'zh-CN' : 'en'} (Alternate: ${altMdUrl})`,
    `- Canonical URL: ${canonicalUrl}`,
    `- GitHub: https://github.com/twn39`,
    ``,
    `---`,
    ``,
  ];

  for (const proj of ESPRESSO_PROJECTS) {
    const info = proj.i18n[lang];
    const linked = posts.filter((p) => p.data.project === proj.slug);
    const cmds = [
      proj.installCmd.uv,
      proj.installCmd.pip,
      proj.installCmd.cargo,
      proj.installCmd.cmake,
      proj.installCmd.git,
    ].filter(Boolean);

    lines.push(
      `## ${proj.repo} (${proj.version})`,
      ``,
      `- Category: ${info.category}`,
      `- Primary Language: ${proj.primaryLang} | License: ${proj.license} | Stars: ${proj.stars}`,
      `- Repository: ${proj.repoUrl}`,
      ...(proj.docsUrl ? [`- Docs: ${proj.docsUrl}`] : []),
      `- Summary: ${info.tagline} — ${info.summary}`,
      `- Highlights:`,
      ...info.highlights.map((h) => `  * ${h}`),
      `- Install / Clone:`,
      ...cmds.map((c) => `  * \`${c}\``),
      ...(linked.length > 0
        ? [
            `- Linked Essays (.md): ${linked
              .map((p) => `[${p.data.title}](${origin}${localizePath(`/blog/${p.data.translationSlug}.md`, lang)})`)
              .join(', ')}`,
          ]
        : []),
      ``
    );
  }

  return lines.join('\n');
}

export function formatClosedSourceProjectsMarkdown(
  origin: string,
  lang: Lang,
  posts: CollectionEntry<'blog'>[]
): string {
  const t = useTranslations(lang);
  const altLang: Lang = lang === 'zh' ? 'en' : 'zh';
  const canonicalUrl = `${origin}${localizePath('/closed-source/', lang)}`;
  const altMdUrl = `${origin}${localizePath('/closed-source.md', altLang)}`;

  const lines: string[] = [
    `# ${t('closed.title')} — ${t('site.name')}`,
    ``,
    `> ${t('closed.subtitle')}`,
    ``,
    `- Language: ${lang === 'zh' ? 'zh-CN' : 'en'} (Alternate: ${altMdUrl})`,
    `- Canonical URL: ${canonicalUrl}`,
    ``,
    `---`,
    ``,
  ];

  for (const app of CLOSED_SOURCE_PROJECTS) {
    const info = app.i18n[lang];
    const linked = posts.filter((p) => p.data.project === app.slug);
    const landingUrl = `${origin}${localizePath(`/apps/${app.slug}/`, lang)}`;
    const appMdUrl = `${origin}${localizePath(`/apps/${app.slug}.md`, lang)}`;

    lines.push(
      `## ${info.displayName} (${app.version} · ${app.deliveryModel})`,
      ``,
      `- Product Page: ${landingUrl} (Markdown: ${appMdUrl})`,
      `- App Store: ${app.appStoreUrl[lang]}`,
      `- Bundle ID: ${app.bundleId}`,
      `- Core Stack: ${app.scaleMetric}`,
      `- Summary: ${info.tagline} — ${info.summary}`,
      `- Highlights:`,
      ...info.highlights.map((h) => `  * ${h}`),
      ...(linked.length > 0
        ? [
            `- Public Architecture Essays (.md): ${linked
              .map((p) => `[${p.data.title}](${origin}${localizePath(`/blog/${p.data.translationSlug}.md`, lang)})`)
              .join(', ')}`,
          ]
        : []),
      ``
    );
  }

  return lines.join('\n');
}

export function formatAppLandingMarkdown(
  origin: string,
  lang: Lang,
  app: EspressoClosedProject,
  posts: CollectionEntry<'blog'>[]
): string {
  const t = useTranslations(lang);
  const info = app.i18n[lang];
  const altLang: Lang = lang === 'zh' ? 'en' : 'zh';
  const canonicalUrl = `${origin}${localizePath(`/apps/${app.slug}/`, lang)}`;
  const altMdUrl = `${origin}${localizePath(`/apps/${app.slug}.md`, altLang)}`;
  const linked = posts.filter((p) => p.data.project === app.slug);

  const lines: string[] = [
    `# ${info.displayName}`,
    ``,
    `> ${info.tagline}`,
    ``,
    `- Language: ${lang === 'zh' ? 'zh-CN' : 'en'} (Alternate: ${altMdUrl})`,
    `- Canonical URL: ${canonicalUrl}`,
    `- App Store: ${app.appStoreUrl[lang]}`,
    `- Platform: ${app.deliveryModel} | Version: ${app.version} | Bundle ID: ${app.bundleId}`,
    `- Core Stack: ${app.scaleMetric}`,
    ...(app.brewCmd ? [`- Homebrew Cask: \`${app.brewCmd}\``] : []),
    ``,
    `---`,
    ``,
    `## ${t('apps.overview')}`,
    ``,
    info.summary,
    ``,
    ...info.highlights.map((h) => `- ${h}`),
    ``,
    `## ${t('closed.arch_spec')}`,
    ``,
    ...app.specs.map((s) => `- **${lang === 'zh' ? s.labelZh : s.labelEn}**: ${s.value}`),
    ``,
  ];

  if (linked.length > 0) {
    lines.push(
      `## ${t('closed.related_posts')}`,
      ``,
      ...linked.map(
        (p) =>
          `- [${p.data.title}](${origin}${localizePath(`/blog/${p.data.translationSlug}.md`, lang)}): ${p.data.description}`
      ),
      ``
    );
  }

  if (info.faqs.length > 0) {
    lines.push(`## ${t('apps.faq')}`, ``);
    for (const faq of info.faqs) {
      lines.push(`### ${faq.q}`, ``, faq.a, ``);
    }
  }

  lines.push(
    `## ${t('apps.support')}`,
    ``,
    t('apps.support_desc'),
    `- Developer GitHub: https://github.com/twn39`,
    `- App Store: ${app.appStoreUrl[lang]}`,
    ``
  );

  return lines.join('\n');
}
