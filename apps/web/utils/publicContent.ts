export const SITE_ORIGIN = 'https://www.markflowy.cc'
export const SITE_LOCALES = ['en', 'zh'] as const
export type SiteLocale = (typeof SITE_LOCALES)[number]

export const SITE_DESCRIPTION: Record<SiteLocale, string> = {
  en: 'Find your writing flow with MarkFlowy, a local-first Markdown editor for macOS, Windows, and Linux. Visual and source editing, with optional AI assistance.',
  zh: '让想法流动，专注每一次写作。MarkFlowy 是适用于 macOS、Windows 和 Linux 的本地优先 Markdown 编辑器，支持所见即所得与源码编辑，可选接入云端 AI 或本地 Ollama 模型。',
}

export interface SocialImage {
  url: string
  alt: string
  width?: number
  height?: number
  type?: string
}

export function getSocialImage(locale: SiteLocale): SocialImage {
  return {
    url: `${SITE_ORIGIN}/social/markflowy-${locale}.png`,
    width: 1200,
    height: 630,
    type: 'image/png',
    alt:
      locale === 'zh'
        ? 'MarkFlowy：让想法流动，专注每一次写作。白色背景上的蓝紫色丝带与本地优先 Markdown 编辑器标语。'
        : 'MarkFlowy: Your ideas, in full flow. Blue and violet ribbons on white, with the local-first Markdown editor tagline.',
  }
}

/** Describe the product without inventing reviews, pricing, or search-result eligibility. */
export function getHomeStructuredData(locale: SiteLocale, description: string) {
  const url = getPageUrl('/', locale)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        name: 'MarkFlowy',
        url: `${SITE_ORIGIN}/`,
        inLanguage: ['en', 'zh-CN'],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_ORIGIN}/#application`,
        name: 'MarkFlowy',
        url,
        description,
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'macOS, Windows, Linux',
        image: getSocialImage(locale).url,
        downloadUrl: 'https://github.com/drl990114/MarkFlowy/releases',
        sameAs: ['https://github.com/drl990114/MarkFlowy'],
      },
    ],
  }
}

export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export const PUBLIC_PAGES = [
  { path: '/', locales: SITE_LOCALES },
  { path: '/docs', locales: SITE_LOCALES },
  { path: '/releases', locales: SITE_LOCALES },
  { path: '/privacy', locales: ['en'] as const },
]

export interface PublicDocumentSource {
  slug: string
  locale: string
  seoTitle: string
  description: string
  updatedAt?: string
  body: { raw: string }
}

export interface PublicDocument {
  slug: string
  locale: SiteLocale
  title: string
  description: string
  updatedAt?: string
  path: string
  url: string
  markdownUrl: string
  markdown: string
}

export function isSiteLocale(locale: string): locale is SiteLocale {
  return locale === 'en' || locale === 'zh'
}

export function normalizePagePath(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0]
  return pathname.replace(/^\/(en|zh)(?=\/|$)/, '').replace(/\/+$/, '') || '/'
}

export function getPageUrl(path: string, locale: SiteLocale = 'en'): string {
  const pathname = normalizePagePath(path)
  return `${SITE_ORIGIN}${locale === 'zh' ? '/zh' : ''}${pathname === '/' && locale === 'zh' ? '' : pathname}`
}

export function getLanguageAlternates(path: string, locales: readonly SiteLocale[]) {
  const alternates = locales.map((locale) => ({
    hrefLang: locale === 'zh' ? 'zh-CN' : 'en',
    href: getPageUrl(path, locale),
  }))
  if (locales.includes('en')) {
    alternates.push({ hrefLang: 'x-default', href: getPageUrl(path, 'en') })
  }
  return alternates
}

export function createPublicDocuments(sources: readonly PublicDocumentSource[]): PublicDocument[] {
  return sources
    .filter((source) => isSiteLocale(source.locale))
    .map((source) => {
      const locale = source.locale as SiteLocale
      const path = `/docs${source.slug}`
      const url = getPageUrl(path, locale)
      return {
        slug: source.slug,
        locale,
        title: source.seoTitle,
        description: source.description,
        ...(source.updatedAt ? { updatedAt: source.updatedAt } : {}),
        path,
        url,
        markdownUrl: `${url}.md`,
        markdown: source.body.raw,
      }
    })
    .sort((left, right) => left.url.localeCompare(right.url))
}

export function getDocumentLocales(document: PublicDocument, documents: readonly PublicDocument[]) {
  return SITE_LOCALES.filter((locale) =>
    documents.some((candidate) => candidate.slug === document.slug && candidate.locale === locale),
  )
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;',
    }
    return entities[character]
  })
}

export function renderSitemap(documents: readonly PublicDocument[]): string {
  const pages = [
    ...PUBLIC_PAGES.flatMap(({ path, locales }) =>
      locales.map((locale) => ({
        path,
        locale,
        locales,
        updatedAt: undefined as string | undefined,
      })),
    ),
    ...documents.map((document) => ({
      ...document,
      locales: getDocumentLocales(document, documents),
    })),
  ]
  const urls = pages.map(({ path, locale, locales, updatedAt }) => {
    const alternates = getLanguageAlternates(path, locales)
      .map(
        ({ hrefLang, href }) =>
          `    <xhtml:link rel="alternate" hreflang="${hrefLang}" href="${escapeXml(href)}" />`,
      )
      .join('\n')
    return [
      '  <url>',
      `    <loc>${escapeXml(getPageUrl(path, locale))}</loc>`,
      ...(updatedAt ? [`    <lastmod>${escapeXml(updatedAt)}</lastmod>`] : []),
      alternates,
      '  </url>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function renderLlmsIndex(documents: readonly PublicDocument[]): string {
  return [
    '# MarkFlowy',
    '',
    `> ${SITE_DESCRIPTION.en}`,
    '',
    'These links describe the desktop application unless a page explicitly says Web App. AI is optional; local inference requires a local model and endpoint. Performance observations are qualified on the performance page.',
    '',
    '## Product',
    '',
    `- [Website](${SITE_ORIGIN}/): Product overview.`,
    '- [GitHub](https://github.com/drl990114/MarkFlowy): Source, issues, and contribution information.',
    '- [Download](https://github.com/drl990114/MarkFlowy/releases/latest): Current desktop release and platform assets.',
    `- [Release notes](${SITE_ORIGIN}/releases): Version-specific changes.`,
    '',
    ...SITE_LOCALES.flatMap((locale) => [
      `## ${locale === 'en' ? 'English documentation' : '中文文档'}`,
      '',
      ...documents
        .filter((document) => document.locale === locale)
        .map(
          (document) => `- [${document.title}](${document.markdownUrl}): ${document.description}`,
        ),
      '',
    ]),
  ].join('\n')
}
