import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const allowedElements = ['strong', 'em', 'code', 'del', 'br', 'img']
const remarkPlugins = [remarkGfm]
const orderedListMarker = /^( {0,3}\d{1,9})([.)])(?=[\t ]|$)/
const components: Components = {
  // A heading can contain an image or link, but the outline remains one link
  // without image requests, nested controls, or block layout.
  img: ({ alt }) => <>{alt}</>,
  br: () => <> </>,
}

export const HeadingTitle = memo(function HeadingTitle({ title }: { title: string }) {
  // Markdown would otherwise parse a leading number as a list marker and drop it.
  const inlineTitle = title.replace(orderedListMarker, '$1\\$2')
  return (
    <Markdown
      allowedElements={allowedElements}
      unwrapDisallowed
      skipHtml
      remarkPlugins={remarkPlugins}
      components={components}
    >
      {inlineTitle}
    </Markdown>
  )
})

export function renderHeadingTitle(title: string) {
  return <HeadingTitle title={title} />
}
