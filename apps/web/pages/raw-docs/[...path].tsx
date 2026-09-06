import { allMarkdowns } from 'contentlayer/generated'
import type { GetServerSideProps } from 'next'
import { createPublicDocuments, SITE_ORIGIN } from '../../utils/publicContent'

export const getServerSideProps: GetServerSideProps = async ({ req, res, params }) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    res.statusCode = 405
    res.end()
    return { props: {} }
  }

  const [locale, ...slug] = Array.isArray(params?.path) ? params.path : []
  const document = createPublicDocuments(allMarkdowns).find(
    (candidate) => candidate.locale === locale && candidate.slug === `/${slug.join('/')}`,
  )

  if (!document) {
    return { notFound: true }
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader(
    'Link',
    `<${document.url}>; rel="canonical", <${SITE_ORIGIN}/llms.txt>; rel="describedby"`,
  )
  res.end(req.method === 'HEAD' ? undefined : document.markdown)
  return { props: {} }
}

export default function RawDocument() {
  return null
}
