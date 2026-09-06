import NextHead from 'next/head'
import { useRouter } from 'next/router'
import {
  getLanguageAlternates,
  getPageUrl,
  SITE_DESCRIPTION,
  SITE_LOCALES,
  SITE_ORIGIN,
  type SiteLocale,
} from '../utils/publicContent'

export interface SeoHeadProps {
  canonical?: string
  description?: string
  image?: string
  title?: string
  url?: string
  availableLocales?: readonly SiteLocale[]
  markdownUrl?: string
}

export default function SeoHead({
  canonical,
  children,
  description,
  image = `${SITE_ORIGIN}/bg.png`,
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

  return (
    <NextHead>
      <title>{title}</title>

      <meta name='description' content={summary} key='description' />

      {/* Open Graph */}
      <link itemProp='url' href={pageUrl} />
      <meta itemProp='name' content={title} />
      <meta itemProp='description' content={summary} />
      <meta itemProp='image' content={image} />

      <meta property='og:locale' content={locale === 'zh' ? 'zh_CN' : 'en_US'} />
      <meta property='og:type' content='website' />
      <meta property='og:title' content={title} />
      <meta property='og:url' content={pageUrl} />
      <meta property='og:image' content={image} />
      <meta property='og:image:height' content='896' />
      <meta property='og:image:width' content='1200' />
      <meta property='og:description' content={summary} />
      <meta property='og:site_name' content='MarkFlowy' />

      <link rel='canonical' href={pageUrl} key='canonical' />
      {alternates.map(({ hrefLang, href }) => (
        <link key={`alternate-${hrefLang}`} rel='alternate' hrefLang={hrefLang} href={href} />
      ))}
      {markdownUrl && <link rel='alternate' type='text/markdown' href={markdownUrl} />}
      <link rel='describedby' href={`${SITE_ORIGIN}/llms.txt`} type='text/plain' />
      {children}

      <link rel='shortcut icon' href='/favicon.png' />
      <link rel='icon' href='/favicon.png' />
    </NextHead>
  )
}
