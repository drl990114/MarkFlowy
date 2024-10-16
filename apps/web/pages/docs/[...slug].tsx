import { allMarkdowns } from 'contentlayer/generated'
import { useRouter } from 'next/router'
import DocsLayout from '../../components/DocsLayout'
import dynamic from 'next/dynamic'
import Loading from 'components/Loading'
import 'prosemirror-flat-list/dist/style.css'

const DynamicThemeProvider = dynamic(() => import('../../components/MdHtmlWrapper'), {
  ssr: false,
  loading: () => <Loading />,
})

const PostLayout = () => {
  const router = useRouter()
  const slug = Array.isArray(router.query?.slug) ? router.query.slug.join('/') : ''

  const markdown = allMarkdowns.find((markdown) => markdown._raw.flattenedPath === slug)

  if (markdown) {
    return (
      <DocsLayout>
        <DynamicThemeProvider
          dangerouslySetInnerHTML={{ __html: markdown.body.html }}
        ></DynamicThemeProvider>
      </DocsLayout>
    )
  } else {
    return <div>not found</div>
  }
}

export default PostLayout
