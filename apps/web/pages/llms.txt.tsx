import { allMarkdowns } from 'contentlayer/generated'
import type { GetServerSideProps } from 'next'
import { createPublicDocuments, renderLlmsIndex } from '../utils/publicContent'

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.end(renderLlmsIndex(createPublicDocuments(allMarkdowns)))
  return { props: {} }
}

export default function LlmsIndex() {
  return null
}
