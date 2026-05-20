import { type Node } from '@rme-sdk/pm/model'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from 'zens'
import type { LinkClickHandler } from '../../extensions/LinkClick'
import { WysiwygThemeWrapper } from '../../theme'
import { rmeProsemirrorNodeToHtml } from '../../utils/prosemirrorNodeToHtml'
import { EditorProps } from '../Editor'
import { createWysiwygDelegate } from '../WysiwygEditor'

interface PreviewProps {
  doc: Node | string
  delegateOptions?: EditorProps['delegateOptions']
  onError?: (e: Error) => void
  handleLinkClick?: LinkClickHandler
}

export type HTMLAstNode = {
  attrs: Record<string, any>
  name: string
  type: string
  children?: HTMLAstNode[]
  content?: string
}

const defaultLinkClickHandler: LinkClickHandler = (href: string, event: MouseEvent) => {
  window.open(href, '_blank', 'noopener,noreferrer')
  return true
}

export const Preview: React.FC<PreviewProps> = (props) => {
  const { doc, delegateOptions, handleLinkClick } = props
  const [processedHtml, setProcessedHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  let targetDoc: PreviewProps['doc'] = doc

  if (typeof targetDoc === 'string') {
    targetDoc = createWysiwygDelegate(delegateOptions).stringToDoc(targetDoc)
  }

  useEffect(() => {
    rmeProsemirrorNodeToHtml(targetDoc, delegateOptions)
      .then((html) => {
        setProcessedHtml(html)
      })
      .catch((e) => {
        props.onError?.(e)
        console.error(e)
      })
  }, [props.onError])

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      const linkElement = target.closest('a')

      if (!linkElement) {
        return
      }

      const href = linkElement.getAttribute('href')
      if (!href) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const handler = handleLinkClick || defaultLinkClickHandler
      handler(href, event.nativeEvent)
    },
    [handleLinkClick],
  )

  if (!processedHtml) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '60px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon.Loading3QuartersOutlined spin size={40} />
      </div>
    )
  }

  return (
    <div ref={containerRef} onClick={handleClick}>
      <WysiwygThemeWrapper dangerouslySetInnerHTML={{ __html: processedHtml }} />
    </div>
  )
}
