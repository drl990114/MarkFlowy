import NextHead from 'next/head'
import { useRouter } from 'next/router'
import {
  getHomeStructuredData,
  getLanguageAlternates,
  getPageUrl,
  getSocialImage,
  normalizePagePath,
  serializeStructuredData,
  SITE_DESCRIPTION,
  SITE_LOCALES,
  SITE_ORIGIN,
  type SiteLocale,
  type SocialImage,
} from '../utils/publicContent'

export interface SeoHeadProps {
  canonical?: string
  description?: string
  image?: string | SocialImage
  title?: string
  url?: string
  availableLocales?: readonly SiteLocale[]
  markdownUrl?: string
}

export default function SeoHead({
  canonical,
  children,
  description,
  image,
  title = 'MarkFlowy',
  url,
  availableLocales = SITE_LOCALES,
  markdownUrl,
}: React.PropsWithChildren<SeoHeadProps>) {
  const router = useRouter()
  const locale = router.locale === 'zh' ? 'zh' : 'en'
  const pageUrl = canonical || url || getPageUrl(router.asPath, locale)
  const summary = description?.trim() || SITE_DESCRIPTION[locale]
  const alternates = getLanguageAlternates(router.asPath, availableLocales)
  const socialImage =
    typeof image === 'string' ? { url: image, alt: title } : image || getSocialImage(locale)
  const imageUrl = new URL(socialImage.url, SITE_ORIGIN).href
  const home = normalizePagePath(router.pathname) === '/'

  return (
    <NextHead>
      <title>{title}</title>

      <meta name='description' content={summary} key='description' />

      <meta property='og:locale' content={locale === 'zh' ? 'zh_CN' : 'en_US'} key='og:locale' />
      {availableLocales.filter((alternate) => alternate !== locale).map((alternate) => (
        <meta
          property='og:locale:alternate'
          content={alternate === 'zh' ? 'zh_CN' : 'en_US'}
          key={`og:locale:alternate:${alternate}`}
        />
      ))}
      <meta property='og:type' content='website' key='og:type' />
      <meta property='og:title' content={title} key='og:title' />
      <meta property='og:url' content={pageUrl} key='og:url' />
      <meta property='og:image' content={imageUrl} key='og:image' />
      <meta property='og:image:alt' content={socialImage.alt} key='og:image:alt' />
      {socialImage.type && (
        <meta property='og:image:type' content={socialImage.type} key='og:image:type' />
      )}
      {socialImage.width && (
        <meta property='og:image:width' content={String(socialImage.width)} key='og:image:width' />
      )}
      {socialImage.height && (
        <meta property='og:image:height' content={String(socialImage.height)} key='og:image:height' />
      )}
      <meta property='og:description' content={summary} key='og:description' />
      <meta property='og:site_name' content='MarkFlowy' key='og:site_name' />

      <meta name='twitter:card' content='summary_large_image' key='twitter:card' />
      <meta name='twitter:title' content={title} key='twitter:title' />
      <meta name='twitter:description' content={summary} key='twitter:description' />
      <meta name='twitter:image' content={imageUrl} key='twitter:image' />
      <meta name='twitter:image:alt' content={socialImage.alt} key='twitter:image:alt' />

      <link rel='canonical' href={pageUrl} key='canonical' />
      {alternates.map(({ hrefLang, href }) => (
        <link key={`alternate-${hrefLang}`} rel='alternate' hrefLang={hrefLang} href={href} />
      ))}
      {markdownUrl && <link rel='alternate' type='text/markdown' href={markdownUrl} />}
      <link rel='describedby' href={`${SITE_ORIGIN}/llms.txt`} type='text/plain' />
      {home && (
        <script
          type='application/ld+json'
          key='site-structured-data'
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(getHomeStructuredData(locale, summary)),
          }}
        />
      )}
      {children}
    </NextHead>
  )
}
