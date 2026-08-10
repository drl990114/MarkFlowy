import { type Node } from '@rme-sdk/sdk/pm/model'
import { useTranslation } from '@markflowy/i18n'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LinkClickHandler } from '../../extensions/LinkClick'
import { WysiwygThemeWrapper } from '../../theme'
import { eventBus } from '../../utils/eventbus'
import { applyImageRequestPolicy } from '../../utils/image-loading'
import {
  prepareProsemirrorPreview,
  type PreparedProsemirrorPreview,
} from '../../utils/prosemirrorNodeToHtml'
import { clearPreviewImageSource } from '../../utils/sanitize-html'
import { defaultStyleToken, type EditorProps } from '../Editor'
import { createWysiwygDelegate } from '../WysiwygEditor'

export interface PreviewImageHydration {
  readonly settled: Promise<void>
}

interface PreviewImageHydrationController extends PreviewImageHydration {
  settle: () => void
}

interface PreviewProps {
  doc: Node | string
  delegate?: EditorProps['delegate']
  delegateOptions?: EditorProps['delegateOptions']
  onError?: (e: Error) => void
  onImageHydrationChange?: (hydration: PreviewImageHydration | null) => void
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
const previewSkeletonLineWidths = ['42%', '88%', '76%', '94%', '67%', '82%']
const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect
const remoteImageSourcePattern = /^(?:https?:)?\/\//i

function createImageHydrationController(): PreviewImageHydrationController {
  let isSettled = false
  let resolveSettled!: () => void
  const settled = new Promise<void>((resolve) => {
    resolveSettled = resolve
  })

  return {
    settled,
    settle: () => {
      if (isSettled) {
        return
      }

      isSettled = true
      resolveSettled()
    },
  }
}

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

function hydratePreviewImages(
  container: HTMLElement,
  imageSources: ReadonlyMap<string, string>,
  resolveImage: NonNullable<PreviewProps['delegateOptions']>['handleViewImgSrcUrl'],
  onPendingChange: (count: number) => void,
  onComplete: () => void,
): () => void {
  let active = true
  let pendingCount = 0
  let completed = false
  const cleanups: (() => void)[] = []
  const resolvedImages = new WeakSet<HTMLImageElement>()
  const settledImages = new WeakSet<HTMLImageElement>()
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'))

  const completeIfReady = () => {
    if (!active || completed || pendingCount !== 0) {
      return
    }

    completed = true
    onComplete()
  }

  images.forEach((image) => {
    let fallbackSource: string | null = null
    applyImageRequestPolicy(image)
    image.setAttribute('decoding', 'async')

    const imageId = image.dataset.mfPreviewImageId
    const source = imageId ? imageSources.get(imageId) : undefined
    if (!source || !resolveImage) {
      image.setAttribute('loading', 'lazy')
      return
    }

    // WebKit can keep displaying the initial data-URI placeholder when a
    // native-lazy image has its src replaced. Host-resolved images already
    // hydrate after Preview is visible, so native lazy loading adds no value.
    image.removeAttribute('loading')
    pendingCount += 1
    image.classList.add('mf-preview-image-loading')
    image.setAttribute('aria-busy', 'true')

    const settleResolution = () => {
      if (!active || resolvedImages.has(image)) {
        return
      }

      resolvedImages.add(image)
      pendingCount -= 1
      onPendingChange(pendingCount)
      completeIfReady()
    }
    const settleImage = (loaded: boolean) => {
      if (!active || settledImages.has(image)) {
        return
      }

      settledImages.add(image)
      image.classList.remove('mf-preview-image-loading')
      image.removeAttribute('aria-busy')
      if (!loaded) {
        image.removeAttribute('src')
      }
    }
    const handleLoad = () => settleImage(true)
    const handleError = () => {
      const nextSource = fallbackSource
      fallbackSource = null
      if (nextSource && active && container.contains(image)) {
        image.addEventListener('error', handleError, { once: true })
        image.setAttribute('src', nextSource)
        return
      }

      settleImage(false)
    }

    void Promise.resolve()
      .then(() => resolveImage(source))
      .then((resolvedSource) => {
        if (!active) {
          return
        }
        if (!container.contains(image)) {
          settleResolution()
          return
        }

        clearPreviewImageSource(image)
        if (!resolvedSource) {
          image.removeAttribute('src')
          settleResolution()
          settleImage(false)
          return
        }

        // Replace the inert placeholder without an intermediate missing-src state.
        // Removing src first can queue a stale error in WebKit that fires after
        // the real source and its listeners have already been installed.
        image.addEventListener('load', handleLoad, { once: true })
        image.addEventListener('error', handleError, { once: true })
        cleanups.push(() => {
          image.removeEventListener('load', handleLoad)
          image.removeEventListener('error', handleError)
        })
        fallbackSource =
          resolvedSource !== source && remoteImageSourcePattern.test(source) ? source : null
        image.setAttribute('src', resolvedSource)
        settleResolution()
      })
      .catch(() => {
        if (!active) {
          return
        }
        if (!container.contains(image)) {
          settleResolution()
          return
        }
        clearPreviewImageSource(image)
        settleResolution()
        settleImage(false)
      })
  })

  onPendingChange(pendingCount)
  completeIfReady()

  return () => {
    active = false
    cleanups.forEach((cleanup) => cleanup())
  }
}

export const Preview: React.FC<PreviewProps> = (props) => {
  const { doc, delegate, delegateOptions, handleLinkClick, styleToken = defaultStyleToken } = props
  const { t } = useTranslation()
  const [preparedPreview, setPreparedPreview] = useState<{
    hydration: PreviewImageHydrationController
    preview: PreparedProsemirrorPreview
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingImageCount, setPendingImageCount] = useState(0)
  const [renderError, setRenderError] = useState<Error | null>(null)
  const [themeGeneration, setThemeGeneration] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeHydrationRef = useRef<PreviewImageHydrationController | null>(null)
  const onErrorRef = useRef(props.onError)
  const onImageHydrationChangeRef = useRef(props.onImageHydrationChange)
  const hasMermaid = useMemo(() => containsMermaid(doc), [doc])
  const previewHtml = preparedPreview?.preview.html ?? ''
  // React compares the dangerouslySetInnerHTML wrapper by identity. Keep it
  // stable so progress updates do not replace images being hydrated in place.
  const previewInnerHtml = useMemo(() => ({ __html: previewHtml }), [previewHtml])
  const previewDelegateOptions = useMemo(
    () => createPreviewDelegateOptions(delegateOptions, doc),
    [delegateOptions, doc],
  )

  onErrorRef.current = props.onError
  onImageHydrationChangeRef.current = props.onImageHydrationChange

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

  useIsomorphicLayoutEffect(() => {
    const hydration = createImageHydrationController()
    activeHydrationRef.current = hydration
    onImageHydrationChangeRef.current?.(hydration)

    return () => {
      hydration.settle()
      if (activeHydrationRef.current === hydration) {
        activeHydrationRef.current = null
        onImageHydrationChangeRef.current?.(null)
      }
    }
  }, [delegate, doc, previewDelegateOptions, themeGeneration])

  useEffect(() => {
    let canceled = false
    const hydration = activeHydrationRef.current
    setIsLoading(true)
    setPendingImageCount(0)
    setRenderError(null)
    setPreparedPreview(null)

    const handle = window.setTimeout(() => {
      try {
        const targetDoc =
          typeof doc === 'string'
            ? (delegate?.view === 'Wysiwyg'
                ? delegate
                : createWysiwygDelegate(previewDelegateOptions)
              ).stringToDoc(doc)
            : doc

        prepareProsemirrorPreview(targetDoc, previewDelegateOptions)
          .then((preview) => {
            if (!canceled && hydration && activeHydrationRef.current === hydration) {
              setPreparedPreview({ hydration, preview })
              setIsLoading(false)
            }
          })
          .catch((e) => {
            if (!canceled) {
              const error = e instanceof Error ? e : new Error(String(e))
              setRenderError(error)
              setIsLoading(false)
              hydration?.settle()
              onErrorRef.current?.(error)
              console.error(error)
            }
          })
      } catch (e) {
        if (!canceled) {
          const error = e instanceof Error ? e : new Error(String(e))
          setRenderError(error)
          setIsLoading(false)
          hydration?.settle()
          onErrorRef.current?.(error)
          console.error(error)
        }
      }
    }, 0)

    return () => {
      canceled = true
      window.clearTimeout(handle)
    }
  }, [delegate, doc, previewDelegateOptions, themeGeneration])

  const handlePendingImageChange = useCallback((count: number) => {
    setPendingImageCount(count)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !preparedPreview) {
      return
    }

    try {
      return hydratePreviewImages(
        container,
        preparedPreview.preview.imageSources,
        previewDelegateOptions?.handleViewImgSrcUrl,
        handlePendingImageChange,
        preparedPreview.hydration.settle,
      )
    } catch (error) {
      preparedPreview.hydration.settle()
      throw error
    }
  }, [handlePendingImageChange, preparedPreview, previewDelegateOptions])

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
      <WysiwygThemeWrapper {...styleToken}>
        <div
          className='mf-preview-loading'
          role='status'
          aria-live='polite'
          aria-label={t('common.loading')}
        >
          <div className='mf-preview-loading-label' aria-hidden='true'>
            <span className='mf-preview-loading-spinner' />
            <span>{t('common.loading')}</span>
          </div>
          <div className='mf-preview-loading-lines' aria-hidden='true'>
            {previewSkeletonLineWidths.map((width) => (
              <span key={width} style={{ width }} />
            ))}
          </div>
        </div>
      </WysiwygThemeWrapper>
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
    <WysiwygThemeWrapper {...styleToken} aria-busy={pendingImageCount > 0 ? 'true' : undefined}>
      {pendingImageCount > 0 ? (
        <div
          key='image-progress'
          className='mf-preview-image-progress'
          role='status'
          aria-live='polite'
          aria-label={t('common.loading')}
        >
          <span className='mf-preview-image-progress-track' aria-hidden='true' />
        </div>
      ) : null}
      <div
        key='preview-content'
        ref={containerRef}
        className='mf-preview-content'
        onClick={handleClick}
        style={{
          padding: '0 var(--rme-editor-inline-padding, clamp(16px, 5vw, 40px))',
        }}
        dangerouslySetInnerHTML={previewInnerHtml}
      />
    </WysiwygThemeWrapper>
  )
}
