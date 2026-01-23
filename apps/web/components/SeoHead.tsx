import NextHead from 'next/head';

export interface SeoHeadProps {
  canonical?: string;
  description?: string;
  image?: string;
  title?: string;
  url?: string;
}

export default function SeoHead({
  canonical,
  children,
  description = 'Modern Markdown editor.',
  image = 'https://www.styled-components.com/atom.png',
  title = 'MarkFlowy',
  url = '',
}: React.PropsWithChildren<SeoHeadProps>) {
  return (
    <NextHead>
      <title>{title}</title>

      <meta name="description" content={description} />

      {/* Open Graph */}
      <link itemProp="url" href="https://markflowy.vercel.app/" />
      <meta itemProp="name" content={title} />
      <meta itemProp="description" content={description} />
      <meta itemProp="image" content="/atom.png" />

      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:height" content="652" />
      <meta property="og:image:width" content="652" />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="MarkFlowy" />

      {children}

      <link rel="shortcut icon" href="/atom.png" />
      <link rel="icon" href="/atom.png" />
    </NextHead>
  );
}
