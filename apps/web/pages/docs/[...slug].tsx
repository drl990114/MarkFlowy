import { allMarkdowns } from 'contentlayer/generated'
import type { GetStaticPaths, GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import DocsContent from '../../components/DocsContent'
import DocsLayout from '../../components/DocsLayout'
import type { DocsLayoutProps } from '../../components/DocsLayout'
import { createPublicDocuments, getDocumentLocales } from '../../utils/publicContent'
import {
  buildDocsTableOfContents,
  type DocsTableOfContentsItem,
} from '../../utils/docsTableOfContents'

interface PostLayoutProps {
  html: string
  tableOfContents: DocsTableOfContentsItem[]
  seo: DocsLayoutProps['seo']
  description: string
}

const PostLayout = ({ html, tableOfContents, seo, description }: PostLayoutProps) => (
  <DocsLayout hasTableOfContents seo={seo} description={description}>
    <DocsContent html={html} tableOfContents={tableOfContents} />
  </DocsLayout>
)

export default PostLayout

export const getStaticPaths: GetStaticPaths = async ({ locales = [] }) => {
  const paths: { params: { slug: string[] }; locale: string }[] = []

  allMarkdowns.forEach((markdown) => {
    const pathParts = markdown._raw.flattenedPath.split('/')
    const docLocale = pathParts[0]
    const docSlug = pathParts.slice(1)

    if (locales.includes(docLocale) && docSlug.length > 0) {
      paths.push({
        params: { slug: docSlug },
        locale: docLocale,
      })
    }
  })

  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<PostLayoutProps> = async ({ locale, params }) => {
  const slug = Array.isArray(params?.slug) ? params.slug.join('/') : ''
  const markdown = allMarkdowns.find((document) => {
    const pathParts = document._raw.flattenedPath.split('/')
    const documentLocale = pathParts[0]
    const documentSlug = pathParts.slice(1).join('/')

    return documentLocale === (locale || 'en') && documentSlug === slug
  })

  if (!markdown) {
    return {
      notFound: true,
    }
  }

  const { html, items } = buildDocsTableOfContents(markdown.body.html)
  const documents = createPublicDocuments(allMarkdowns)
  const document = documents.find(
    (candidate) => candidate.slug === markdown.slug && candidate.locale === markdown.locale,
  )!

  return {
    props: {
      html,
      tableOfContents: items,
      description: document.description,
      seo: {
        title: document.title,
        canonical: document.url,
        markdownUrl: document.markdownUrl,
        availableLocales: getDocumentLocales(document, documents),
      },
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
