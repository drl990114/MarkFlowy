import NextHead from 'next/head'

export interface SeoHeadProps {
  canonical?: string
  description?: string
  image?: string
  title?: string
  url?: string
}

export default function SeoHead({
  canonical,
  children,
  description = 'A local-first, AI-assisted Markdown editor for focused writing.',
  image = 'https://markflowy.cc/bg.png',
  title = 'MarkFlowy',
  url = canonical || 'https://markflowy.cc/',
}: React.PropsWithChildren<SeoHeadProps>) {
  return (
    <NextHead>
      <title>{title}</title>

      <meta name='description' content={description} />

      {/* Open Graph */}
      <link itemProp='url' href={url} />
      <meta itemProp='name' content={title} />
      <meta itemProp='description' content={description} />
      <meta itemProp='image' content={image} />

      <meta property='og:locale' content='en_US' />
      <meta property='og:type' content='website' />
      <meta property='og:title' content={title} />
      <meta property='og:url' content={url} />
      <meta property='og:image' content={image} />
      <meta property='og:image:height' content='896' />
      <meta property='og:image:width' content='1200' />
      <meta property='og:description' content={description} />
      <meta property='og:site_name' content='MarkFlowy' />

      {canonical && <link rel='canonical' href={canonical} />}
      {children}

      <link rel='shortcut icon' href='/favicon.png' />
      <link rel='icon' href='/favicon.png' />
    </NextHead>
  )
}
