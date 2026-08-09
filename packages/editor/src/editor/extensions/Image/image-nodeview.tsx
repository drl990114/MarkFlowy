import type { NodeViewComponentProps } from '@rme-sdk/sdk/react'
import { omit } from 'lodash'
import { normalizeReference } from 'markdown-it/lib/common/utils.mjs'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import type { PopoverStore } from 'zens'
import { Popover, Image as ZensImage } from 'zens'
import type { ExtensionsOptions } from '..'
import { Resizable } from '../../components/Resizable'
import { editorZIndex } from '../../theme/z-index'
import { isBrowser } from '../../utils/common'
import {
  IMAGE_REFERRER_POLICY,
  normalizeImageSourceForBrowser,
  preloadImageSource,
} from './image-source'
import { ImagePlaceholder } from './image-placeholder'
import { ImageToolTips } from './image-tool-tips'

export interface ImageNodeViewProps extends NodeViewComponentProps {
  resizeable?: boolean
  defaultSyntaxType?: 'html' | 'md'
  handleViewImgSrcUrl?: ExtensionsOptions['handleViewImgSrcUrl']
  imagePasteHandler?: ExtensionsOptions['imagePasteHandler']
  imageHostingHandler?: (src: string) => Promise<string>
}

export type ReferInfo = {
  label?: string
}
export function ImageNodeView(props: ImageNodeViewProps) {
  const {
    node,
    selected,
    updateAttributes,
    handleViewImgSrcUrl,
    imagePasteHandler,
    imageHostingHandler,
    view,
  } = props
  const initRef = useRef<() => void>(null)
  const popoverStore = useRef<PopoverStore>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const fromPaste = node.attrs['data-rme-from-paste'] === 'true'
  const referLabel = node.attrs['data-refer-label'] as string | undefined
  const curRefer = useMemo(() => {
    if (!referLabel) return undefined

    for (const refer of view.state.doc.content.content) {
      if (refer.type.name !== 'reference_def') continue
      const labelNode = refer.content.content.find(
        (contentNode) => contentNode.type.name === 'reference_label',
      )
      const hrefNode = refer.content.content.find(
        (contentNode) => contentNode.type.name === 'reference_href',
      )
      const titleNode = refer.content.content.find(
        (contentNode) => contentNode.type.name === 'reference_title',
      )
      if (!labelNode?.textContent) continue
      if (normalizeReference(labelNode?.textContent) === normalizeReference(referLabel)) {
        return {
          href: hrefNode?.textContent || '',
          title: titleNode?.textContent || '',
          label: labelNode?.textContent || '',
        }
      }
    }

    return undefined
  }, [referLabel, view.state.doc])

  const handlePasteEvent = useEffectEvent(async () => {
    let src = node.attrs.src || ''
    if (imagePasteHandler) {
      try {
        src = await imagePasteHandler(node.attrs.src)
      } catch (error) {}
    }

    updateAttributes({
      'data-rme-from-paste': null,
      src,
    })
  })

  useEffect(() => {
    if (fromPaste) {
      handlePasteEvent()
    }
    // React Effect Events intentionally stay outside effect dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPaste])

  const handleStoreChange = useCallback((store: PopoverStore) => {
    popoverStore.current = store
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        popoverStore.current &&
        (!event.target ||
          !(event.target instanceof Node) ||
          !popoverRef.current.contains(event.target))
      ) {
        popoverStore.current.setOpen(false)
      }
    }

    if (selected && isBrowser()) {
      document.addEventListener('mousedown', handleOutsideClick)
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick)
      }
    }
  }, [selected])

  const handleResizeAttributes = useCallback(() => ({ 'data-rme-type': 'html' }), [])
  const handleControlInit = useCallback((init: () => void) => {
    initRef.current = init
  }, [])
  const closePopover = useCallback(() => {
    popoverStore.current?.setOpen(false)
  }, [])
  const loadImageSource = useCallback(
    async (source: string) => {
      let resolvedSource = source
      if (handleViewImgSrcUrl) {
        try {
          resolvedSource = await handleViewImgSrcUrl(source)
        } catch {
          resolvedSource = source
        }
      }

      const candidates = new Set([
        normalizeImageSourceForBrowser(resolvedSource),
        normalizeImageSourceForBrowser(source),
      ])
      for (const candidate of candidates) {
        if (!candidate) continue
        try {
          return await preloadImageSource(candidate)
        } catch {
          // Try the original source when a rendered local or remote URL fails.
        }
      }

      throw new Error('Unable to load image source')
    },
    [handleViewImgSrcUrl],
  )

  const Loading = (
    <span className='inline-loading'>
      <i className='inline-loading-icon ri-loader-4-line'></i>
    </span>
  )

  if (fromPaste) {
    return Loading
  }

  const originSrc = curRefer?.href || node.attrs.src || ''
  const placeholderStyle = {
    height: node.attrs.height ? '100%' : 112,
    width: node.attrs.width ? '100%' : 220,
  }
  const otherAttrs = {
    ...omit(node.attrs, 'data-refer-label'),
    'data-rme-original-src': originSrc,
  }
  const Main = (
    <Resizable
      controlInit={handleControlInit}
      getResizeAttributes={handleResizeAttributes}
      {...props}
    >
      <ZensImage
        {...otherAttrs}
        onLoad={() => initRef.current?.()}
        src={originSrc}
        loader={Loading}
        emptyImage={<ImagePlaceholder style={placeholderStyle} variant='empty' />}
        unloader={<ImagePlaceholder style={placeholderStyle} variant='error' />}
        unloaderStyle={{ background: 'transparent', border: 'none' }}
        imgPromise={loadImageSource}
        referrerPolicy={IMAGE_REFERRER_POLICY}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </Resizable>
  )

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'relative',
        zIndex: selected ? editorZIndex.imageSelected : 'auto',
        lineHeight: 0,
      }}
    >
      <Popover
        customContent={
          <ImageToolTips
            node={node}
            referInfo={curRefer}
            imageHostingHandler={imageHostingHandler}
            onRequestClose={closePopover}
            updateAttributes={updateAttributes}
          />
        }
        boxProps={{
          style: {
            display: 'inline-flex',
          },
        }}
        placement='top-start'
        arrow={false}
        hideOnEscape={false}
        onStoreChange={handleStoreChange}
        toggleOnClick
        unmountOnHide
        style={{ zIndex: editorZIndex.imageToolbar, padding: 0 }}
      >
        {Main}
      </Popover>
    </div>
  )
}
