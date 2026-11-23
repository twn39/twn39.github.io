import type { CollectionEntry } from 'astro:content';
import {
  getClosedProjectBySlug,
  getProjectBySlug,
  type EspressoClosedProject,
  type EspressoProject,
} from '../data/projects';
import githubProfile from '../data/github-profile.json';
import { localizePath, useTranslations, type Lang } from '../i18n/ui';

export type JsonLdNode = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  path: string;
}

function getIds(origin: string) {
  return {
    personId: `${origin}/#person`,
    websiteId: `${origin}/#website`,
  };
}

function buildBaseEntities(origin: string): JsonLdNode[] {
  const { personId, websiteId } = getIds(origin);

  const person: JsonLdNode = {
    '@type': 'Person',
    '@id': personId,
    name: 'Tang Weinan (twn39)',
    alternateName: 'twn39',
    url: origin,
    image: githubProfile.avatarUrl || `${origin}/og-default.png`,
    sameAs: ['https://github.com/twn39'],
  };

  const webSite: JsonLdNode = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: origin,
    name: 'BitesBytes Lab',
    inLanguage: ['zh-CN', 'en'],
    publisher: { '@id': personId },
  };

  return [person, webSite];
}

function buildBreadcrumbList(origin: string, items: BreadcrumbItem[], pageUrl: string): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: new URL(item.path, origin).toString(),
    })),
  };
}

function buildSoftwareSourceCode(
  origin: string,
  lang: Lang,
  proj: EspressoProject
): JsonLdNode {
  const { personId } = getIds(origin);
  return {
    '@type': 'SoftwareSourceCode',
    '@id': `${origin}${localizePath('/projects/', lang)}#${proj.slug}`,
    name: proj.name,
    description: proj.i18n[lang].summary,
    codeRepository: proj.repoUrl,
    url: proj.docsUrl || proj.repoUrl,
    programmingLanguage: proj.languages.map((l) => l.name),
    softwareVersion: proj.version,
    license: proj.license,
    author: { '@id': personId },
  };
}

function getClosedAppCategory(slug: string): string {
  switch (slug) {
    case 'symmath':
      return 'EducationApplication';
    case 'cappuccino':
      return 'UtilitiesApplication';
    default:
      return 'PhotoAndVideoApplication';
  }
}

function buildClosedAppEntity(
  origin: string,
  lang: Lang,
  app: EspressoClosedProject,
  useLandingId = false
): JsonLdNode {
  const { personId } = getIds(origin);
  const os =
    app.deliveryModel === 'iOS'
      ? 'iOS'
      : app.deliveryModel === 'macOS'
        ? 'macOS'
        : 'iOS, macOS';
  const landingUrl = new URL(localizePath(`/apps/${app.slug}/`, lang), origin).toString();
  const id = useLandingId
    ? `${landingUrl}#app`
    : `${origin}${localizePath('/closed-source/', lang)}#${app.slug}`;

  return {
    '@type': app.deliveryModel === 'macOS' ? 'SoftwareApplication' : 'MobileApplication',
    '@id': id,
    name: app.i18n[lang].displayName,
    description: app.i18n[lang].summary,
    operatingSystem: os,
    applicationCategory: getClosedAppCategory(app.slug),
    softwareVersion: app.version,
    image: new URL(app.iconPath, origin).toString(),
    installUrl: app.appStoreUrl[lang],
    url: landingUrl,
    sameAs: app.appStoreUrl[lang],
    author: { '@id': personId },
  };
}

export function buildHomeJsonLd(
  origin: string,
  lang: Lang,
  title: string,
  description: string,
  canonicalUrl: string
): JsonLdNode {
  const { personId, websiteId } = getIds(origin);
  const profilePage: JsonLdNode = {
    '@type': 'ProfilePage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
    isPartOf: { '@id': websiteId },
    mainEntity: { '@id': personId },
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [...buildBaseEntities(origin), profilePage],
  };
}

export function buildOpenSourceProjectsJsonLd(
  origin: string,
  lang: Lang,
  title: string,
  description: string,
  canonicalUrl: string,
  projects: EspressoProject[]
): JsonLdNode {
  const t = useTranslations(lang);
  const { websiteId } = getIds(origin);
  const breadcrumb = buildBreadcrumbList(
    origin,
    [
      { name: t('nav.overview'), path: localizePath('/', lang) },
      { name: t('nav.projects'), path: localizePath('/projects/', lang) },
    ],
    canonicalUrl
  );

  const collectionPage: JsonLdNode = {
    '@type': 'CollectionPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
    isPartOf: { '@id': websiteId },
    breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: projects.map((proj, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: buildSoftwareSourceCode(origin, lang, proj),
      })),
    },
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [...buildBaseEntities(origin), breadcrumb, collectionPage],
  };
}

export function buildClosedSourceProjectsJsonLd(
  origin: string,
  lang: Lang,
  title: string,
  description: string,
  canonicalUrl: string,
  apps: EspressoClosedProject[]
): JsonLdNode {
  const t = useTranslations(lang);
  const { websiteId } = getIds(origin);
  const breadcrumb = buildBreadcrumbList(
    origin,
    [
      { name: t('nav.overview'), path: localizePath('/', lang) },
      { name: t('nav.closed_projects'), path: localizePath('/closed-source/', lang) },
    ],
    canonicalUrl
  );

  const collectionPage: JsonLdNode = {
    '@type': 'CollectionPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
    isPartOf: { '@id': websiteId },
    breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: apps.map((app, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: buildClosedAppEntity(origin, lang, app),
      })),
    },
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [...buildBaseEntities(origin), breadcrumb, collectionPage],
  };
}

export function buildBlogListJsonLd(
  origin: string,
  lang: Lang,
  title: string,
  description: string,
  canonicalUrl: string,
  posts: CollectionEntry<'blog'>[]
): JsonLdNode {
  const t = useTranslations(lang);
  const { personId, websiteId } = getIds(origin);
  const breadcrumb = buildBreadcrumbList(
    origin,
    [
      { name: t('nav.overview'), path: localizePath('/', lang) },
      { name: t('nav.blog'), path: localizePath('/blog/', lang) },
    ],
    canonicalUrl
  );

  const blogEntity: JsonLdNode = {
    '@type': 'Blog',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
    isPartOf: { '@id': websiteId },
    breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
    publisher: { '@id': personId },
    blogPost: posts.map((p) => {
      const postUrl = new URL(
        localizePath(`/blog/${p.data.translationSlug}/`, lang),
        origin
      ).toString();
      return {
        '@type': 'TechArticle',
        '@id': `${postUrl}#article`,
        headline: p.data.title,
        description: p.data.description,
        url: postUrl,
        datePublished: p.data.pubDate.toISOString(),
        dateModified: (p.data.updatedDate || p.data.pubDate).toISOString(),
        image: new URL(p.data.coverImage, origin).toString(),
        author: { '@id': personId },
      };
    }),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [...buildBaseEntities(origin), breadcrumb, blogEntity],
  };
}

export function buildBlogPostJsonLd(
  origin: string,
  lang: Lang,
  post: CollectionEntry<'blog'>,
  canonicalUrl: string
): JsonLdNode {
  const t = useTranslations(lang);
  const { personId, websiteId } = getIds(origin);
  const breadcrumb = buildBreadcrumbList(
    origin,
    [
      { name: t('nav.overview'), path: localizePath('/', lang) },
      { name: t('nav.blog'), path: localizePath('/blog/', lang) },
      { name: post.data.title, path: localizePath(`/blog/${post.data.translationSlug}/`, lang) },
    ],
    canonicalUrl
  );

  const openProj = getProjectBySlug(post.data.project);
  const closedProj = getClosedProjectBySlug(post.data.project);
  const aboutEntity = openProj
    ? buildSoftwareSourceCode(origin, lang, openProj)
    : closedProj
      ? buildClosedAppEntity(origin, lang, closedProj)
      : undefined;

  const webPage: JsonLdNode = {
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: post.data.title,
    description: post.data.description,
    inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
    isPartOf: { '@id': websiteId },
    breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
    mainEntity: { '@id': `${canonicalUrl}#article` },
  };

  const techArticle: JsonLdNode = {
    '@type': 'TechArticle',
    '@id': `${canonicalUrl}#article`,
    isPartOf: { '@id': `${canonicalUrl}#webpage` },
    mainEntityOfPage: { '@id': `${canonicalUrl}#webpage` },
    headline: post.data.title,
    description: post.data.description,
    image: new URL(post.data.coverImage, origin).toString(),
    datePublished: post.data.pubDate.toISOString(),
    dateModified: (post.data.updatedDate || post.data.pubDate).toISOString(),
    inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
    keywords: post.data.tags.join(', '),
    timeRequired: `PT${post.data.readingTime}M`,
    url: canonicalUrl,
    author: { '@id': personId },
    publisher: { '@id': personId },
    ...(aboutEntity ? { about: aboutEntity } : {}),
  };

  const faqPage: JsonLdNode | undefined =
    post.data.faqs && post.data.faqs.length > 0
      ? {
          '@type': 'FAQPage',
          '@id': `${canonicalUrl}#faq`,
          mainEntity: post.data.faqs.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.a,
            },
          })),
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...buildBaseEntities(origin),
      breadcrumb,
      webPage,
      techArticle,
      ...(faqPage ? [faqPage] : []),
    ],
  };
}

export function buildAppLandingJsonLd(
  origin: string,
  lang: Lang,
  app: EspressoClosedProject,
  canonicalUrl: string
): JsonLdNode {
  const t = useTranslations(lang);
  const { websiteId } = getIds(origin);
  const info = app.i18n[lang];

  const breadcrumb = buildBreadcrumbList(
    origin,
    [
      { name: t('nav.overview'), path: localizePath('/', lang) },
      { name: t('nav.closed_projects'), path: localizePath('/closed-source/', lang) },
      { name: app.name, path: localizePath(`/apps/${app.slug}/`, lang) },
    ],
    canonicalUrl
  );

  const appEntity = buildClosedAppEntity(origin, lang, app, true);

  const webPage: JsonLdNode = {
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: info.displayName,
    description: info.tagline,
    inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
    isPartOf: { '@id': websiteId },
    breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
    mainEntity: { '@id': `${canonicalUrl}#app` },
  };

  const faqPage: JsonLdNode | undefined =
    info.faqs.length > 0
      ? {
          '@type': 'FAQPage',
          '@id': `${canonicalUrl}#faq`,
          mainEntity: info.faqs.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.a,
            },
          })),
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...buildBaseEntities(origin),
      breadcrumb,
      webPage,
      appEntity,
      ...(faqPage ? [faqPage] : []),
    ],
  };
}
