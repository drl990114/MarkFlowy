import type { DocsTableOfContentsItem } from '../utils/docsTableOfContents'
import DocsTableOfContents from './DocsTableOfContents'
import DocumentArticle from './document/DocumentArticle'

type DocsContentProps = {
  html: string
  tableOfContents?: DocsTableOfContentsItem[]
}

const DocsContent = ({ html, tableOfContents = [] }: DocsContentProps) => {
  return (
    <>
      <DocumentArticle dangerouslySetInnerHTML={{ __html: html }} />
      <DocsTableOfContents items={tableOfContents} />
    </>
  )
}

export default DocsContent
