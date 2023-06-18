import Head from 'next/head'

interface MetaProps {
  title?: string
  path?: string
}

export function Meta({ title }: MetaProps) {
  return (
    <Head>
      <>
        <title>{`${title}`}</title>
        <meta property="og:image:width" content="800" />
        <meta property="og:image:height" content="600" />
      </>
    </Head>
  )
}
