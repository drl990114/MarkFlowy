import Loading from 'components/Loading'
import { allMarkdowns } from 'contentlayer/generated'
import { GetStaticPaths, GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import DocsLayout from '../../components/DocsLayout'
import RmeProvider from '../../components/RmeProvider'

const DynamicMdHtmlWrapper = dynamic(() => import('../../components/MdHtmlWrapper'), {
  ssr: false,
  loading: () => <Loading />,
})

const PostLayout = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const currentLocale = router.locale || 'en'
  const slug = Array.isArray(router.query?.slug) ? router.query.slug.join('/') : ''

  // Find markdown by locale and slug
  const markdown = allMarkdowns.find((markdown) => {
    const pathParts = markdown._raw.flattenedPath.split('/')
    const docLocale = pathParts[0]
    const docSlug = pathParts.slice(1).join('/')
    return docLocale === currentLocale && docSlug === slug
  })

  if (markdown) {
    return (
      <DocsLayout>
        <RmeProvider>
          <DynamicMdHtmlWrapper
            dangerouslySetInnerHTML={{ __html: markdown.body.html }}
          ></DynamicMdHtmlWrapper>
        </RmeProvider>
      </DocsLayout>
    )
  } else {
    return <div>{t('docs.content.notFound')}</div>
  }
}

export default PostLayout

export const getStaticPaths: GetStaticPaths = async ({ locales = [] }) => {
  const paths: Array<{ params: { slug: string[] }; locale: string }> = []

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

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
