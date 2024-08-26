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
  title = 'styled-components',
  url = '',
}: React.PropsWithChildren<SeoHeadProps>) {
  const properCanonical = canonical || url;

  return (
    <NextHead>
      <title>{title}</title>

      <meta name="description" content={description} />

      {/* Open Graph */}
      <link itemProp="url" href="https://styled-components.com/" />
      <meta itemProp="name" content={title} />
      <meta itemProp="description" content={description} />
      <meta itemProp="image" content="/atom.png" />

      <meta name="google-site-verification" content="lWntYW6AWVMcShSIWLmOzKr8Wyek2TR-zuQn6_XGu_c" />

      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:height" content="652" />
      <meta property="og:image:width" content="652" />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="styled-components" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@mxstbr" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:creator" content="@mxstbr" />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:image:src" content="https://styled-components.com/meta.png" />

      <link rel="canonical" href={`https://www.styled-components.com${properCanonical}`} />

      {children}

      <link rel="shortcut icon" href="/atom.png" />
      <link rel="icon" href="/atom.png" />
    </NextHead>
  );
}
