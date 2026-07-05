import MdHtmlWrapper from './MdHtmlWrapper'
import RmeProvider from './RmeProvider'

type DocsRmeContentProps = {
  html: string
}

const DocsRmeContent = ({ html }: DocsRmeContentProps) => {
  return (
    <RmeProvider>
      <MdHtmlWrapper dangerouslySetInnerHTML={{ __html: html }} />
    </RmeProvider>
  )
}

export default DocsRmeContent
