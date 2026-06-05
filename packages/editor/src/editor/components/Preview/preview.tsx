import { type Node } from '@rme-sdk/pm/model'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from 'zens'
import type { LinkClickHandler } from '../../extensions/LinkClick'
import { WysiwygThemeWrapper } from '../../theme'
import { rmeProsemirrorNodeToHtml } from '../../utils/prosemirrorNodeToHtml'
import { defaultStyleToken, EditorProps } from '../Editor'
import { createWysiwygDelegate } from '../WysiwygEditor'

interface PreviewProps {
  doc: Node | string
  delegateOptions?: EditorProps['delegateOptions']
  onError?: (e: Error) => void
  handleLinkClick?: LinkClickHandler
  styleToken?: EditorProps['styleToken']
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
  const { doc, delegateOptions, handleLinkClick, styleToken = defaultStyleToken } = props
  const [processedHtml, setProcessedHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const onErrorRef = useRef(props.onError)

  onErrorRef.current = props.onError

  useEffect(() => {
    let canceled = false
    setProcessedHtml('')

    const handle = window.setTimeout(() => {
      try {
        const targetDoc =
          typeof doc === 'string'
            ? createWysiwygDelegate(delegateOptions).stringToDoc(doc)
            : doc

        rmeProsemirrorNodeToHtml(targetDoc, delegateOptions)
          .then((html) => {
            if (!canceled) {
              setProcessedHtml(html)
            }
          })
          .catch((e) => {
            if (!canceled) {
              onErrorRef.current?.(e)
              console.error(e)
            }
          })
      } catch (e) {
        if (!canceled) {
          onErrorRef.current?.(e as Error)
          console.error(e)
        }
      }
    }, 0)

    return () => {
      canceled = true
      window.clearTimeout(handle)
    }
  }, [delegateOptions, doc])

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
    <WysiwygThemeWrapper {...styleToken}>
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{ padding: '0 40px' }}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </WysiwygThemeWrapper>
  )
}
