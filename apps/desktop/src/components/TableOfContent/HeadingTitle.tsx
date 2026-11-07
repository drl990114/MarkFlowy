import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const allowedElements = ['strong', 'em', 'code', 'del', 'br', 'img']
const remarkPlugins = [remarkGfm]
const components: Components = {
  // A heading can contain an image or link, but the outline remains one link
  // without image requests, nested controls, or block layout.
  img: ({ alt }) => <>{alt}</>,
  br: () => <> </>,
}

export const HeadingTitle = memo(function HeadingTitle({ title }: { title: string }) {
  return (
    <Markdown
      allowedElements={allowedElements}
      unwrapDisallowed
      skipHtml
      remarkPlugins={remarkPlugins}
      components={components}
    >
      {title}
    </Markdown>
  )
})

export function renderHeadingTitle(title: string) {
  return <HeadingTitle title={title} />
}
