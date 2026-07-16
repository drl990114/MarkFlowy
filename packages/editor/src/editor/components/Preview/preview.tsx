import { type Node } from '@rme-sdk/pm/model'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loading } from 'zens'
import type { LinkClickHandler } from '../../extensions/LinkClick'
import { WysiwygThemeWrapper } from '../../theme'
import { eventBus } from '../../utils/eventbus'
import { rmeProsemirrorNodeToHtml } from '../../utils/prosemirrorNodeToHtml'
import { defaultStyleToken, type EditorProps } from '../Editor'
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

const defaultLinkClickHandler: LinkClickHandler = (href: string) => {
  window.open(href, '_blank', 'noopener,noreferrer')
  return true
}

const mermaidFencePattern = /^ {0,3}(?:`{3,}|~{3,})[\t ]*mermaid(?:[\t ].*)?$/im

function containsMermaid(doc: Node | string): boolean {
  if (typeof doc === 'string') {
    return mermaidFencePattern.test(doc)
  }

  let found = false
  doc.descendants((node) => {
    if (node.type.name === 'mermaid_node') {
      found = true
      return false
    }
    return !found
  })
  return found
}

function createPreviewDelegateOptions(
  delegateOptions: PreviewProps['delegateOptions'],
  _doc: Node | string,
): PreviewProps['delegateOptions'] {
  // The document argument scopes the memoized resolver cache to one document.
  void _doc
  const resolveImage = delegateOptions?.handleViewImgSrcUrl
  if (!resolveImage) {
    return delegateOptions
  }

  const resolvedImages = new Map<string, Promise<string>>()
  return {
    ...delegateOptions,
    handleViewImgSrcUrl: (source: string) => {
      const cached = resolvedImages.get(source)
      if (cached) {
        return cached
      }

      const pending = resolveImage(source).catch((error) => {
        resolvedImages.delete(source)
        throw error
      })
      resolvedImages.set(source, pending)
      return pending
    },
  }
}

export const Preview: React.FC<PreviewProps> = (props) => {
  const { doc, delegateOptions, handleLinkClick, styleToken = defaultStyleToken } = props
  const [processedHtml, setProcessedHtml] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [renderError, setRenderError] = useState<Error | null>(null)
  const [themeGeneration, setThemeGeneration] = useState(0)
  const onErrorRef = useRef(props.onError)
  const hasMermaid = useMemo(() => containsMermaid(doc), [doc])
  const previewDelegateOptions = useMemo(
    () => createPreviewDelegateOptions(delegateOptions, doc),
    [delegateOptions, doc],
  )

  onErrorRef.current = props.onError

  useEffect(() => {
    const handleThemeChange = () => {
      if (hasMermaid) {
        setThemeGeneration((generation) => generation + 1)
      }
    }
    eventBus.on('change-theme', handleThemeChange)

    return () => {
      eventBus.detach('change-theme', handleThemeChange)
    }
  }, [hasMermaid])

  useEffect(() => {
    let canceled = false
    setIsLoading(true)
    setRenderError(null)
    setProcessedHtml('')

    const handle = window.setTimeout(() => {
      try {
        const targetDoc =
          typeof doc === 'string'
            ? createWysiwygDelegate(previewDelegateOptions).stringToDoc(doc)
            : doc

        rmeProsemirrorNodeToHtml(targetDoc, previewDelegateOptions)
          .then((html) => {
            if (!canceled) {
              setProcessedHtml(html)
              setIsLoading(false)
            }
          })
          .catch((e) => {
            if (!canceled) {
              const error = e instanceof Error ? e : new Error(String(e))
              setRenderError(error)
              setIsLoading(false)
              onErrorRef.current?.(error)
              console.error(error)
            }
          })
      } catch (e) {
        if (!canceled) {
          const error = e instanceof Error ? e : new Error(String(e))
          setRenderError(error)
          setIsLoading(false)
          onErrorRef.current?.(error)
          console.error(error)
        }
      }
    }, 0)

    return () => {
      canceled = true
      window.clearTimeout(handle)
    }
  }, [doc, previewDelegateOptions, themeGeneration])

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

  if (isLoading) {
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
        <Loading size={40} />
      </div>
    )
  }

  if (renderError) {
    return (
      <WysiwygThemeWrapper {...styleToken}>
        <pre className='mf-preview-error' role='alert'>
          {renderError.message}
        </pre>
      </WysiwygThemeWrapper>
    )
  }

  return (
    <WysiwygThemeWrapper {...styleToken}>
      <div
        className='mf-preview-content'
        onClick={handleClick}
        style={{
          padding: '0 var(--rme-editor-inline-padding, clamp(16px, 5vw, 40px))',
        }}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </WysiwygThemeWrapper>
  )
}
