import type { NodeViewComponentProps } from '@rme-sdk/react'
import { omit } from 'lodash'
import { normalizeReference } from 'markdown-it/lib/common/utils.mjs'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import type { PopoverStore } from 'zens'
import { Popover, Image as ZensImage } from 'zens'
import type { ExtensionsOptions } from '..'
import { Resizable } from '../../components/Resizable'
import { isBrowser } from '../../utils/common'
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
const warningFallBack =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAAAAACIM/FCAAAChElEQVR4Ae3aMW/TQBxAcb70k91AAiGuGlZAtOlQApWaDiSdklZq2RPUTm1xUWL3PgqSpygkXlh88N54nn7S2Trd3y/CP5IQIUKECBEiRIgQIUKECBEiRIgQIUKECBEiRIgQIUKECBEiRIgQIUKECBEiRIgQIUKECBEiRIgQIUKECPmPIEKECBEiRIgQIeX82+FBO0naB4eTRRkt5P7sNWt1Rw9RQvKThI2SYR4f5OoVW2rfRAYpT6hqHc8WeVHki9mgRdWwiAmyfA9AdrlaW5tlAHxcxQMpK8feRbGxPEkrSREN5ARg/y780V0GMIwFcgXwLg9byvsAN3FA8lfAfr7jYQZ0nqKAfAb21vYVwNruSoEvMUDuE+Ai7IKECZA+RAA5A7JiN6TMgFHzIeUb4DLshoQZ0H1uPGQOvFzVQZYtYNF4yBg4DnWQMAAmjYccArN6yBQ4ajzkAFjUQ+ZAv/GQNpDXQ3Kg03hIAhT1kAJIhLi1/vJl39Ic6Mf3+a2K8PM7BgahtgEwjuKI0lqGjSI8opRdYFb3sk/jODSGEZCVuyFFDzgPzYc8JMBkN2QMpI8RQMIQ2LvdBblNgdM4Lh/aQJaHrf3sAe2nKCDhGqCfb3VEcx1UNQTItlzQ3fYAvoZYIMUHgHRSbiyPU4BPZUSX2JWEbLZcW5v2qByrmMYKxZCq1mA6z4sin08HLapOy8gGPddtttT5HuHobZiwUXr6K85h6KjLWm/PH+MdTy/GR/12knb6g8mPZ38YECJEiBAhQoQIESJEiBAhQoQIESJEiBAhQoQIESJEiBAhQoQIESJEiBAhQoQIESJEiBAhQoQIESJEiBAhQoQIESJEiBAh0fUb5q7oCGreEVEAAAAASUVORK5CYII='

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
  const refers = view.state.doc.content.content.filter((node) => node.type.name === 'reference_def')
  const curRefer = useMemo(() => {
    let res:
      | {
          href?: string
          title?: string
          label?: string
        }
      | undefined

    refers.forEach((refer) => {
      const labelNode = refer.content.content.find(
        (contentNode) => contentNode.type.name === 'reference_label',
      )
      const hrefNode = refer.content.content.find(
        (contentNode) => contentNode.type.name === 'reference_href',
      )
      const titleNode = refer.content.content.find(
        (contentNode) => contentNode.type.name === 'reference_title',
      )
      if (!labelNode?.textContent || !node.attrs['data-refer-label']) {
        return
      }
      if (
        normalizeReference(labelNode?.textContent) ===
        normalizeReference(node.attrs['data-refer-label'])
      ) {
        res = {
          href: hrefNode?.textContent || '',
          title: titleNode?.textContent || '',
          label: labelNode?.textContent || '',
        }
      }
    })

    return res
  }, [refers])

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
  }, [fromPaste])

  const handleStoreChange = (store: PopoverStore) => {
    popoverStore.current = store
  }

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

  const handleResize = useCallback(() => {
    updateAttributes({
      ['data-rme-type']: 'html',
    })
  }, [updateAttributes])

  const Loading = (
    <span className="inline-loading">
      <i className="inline-loading-icon ri-loader-4-line"></i>
    </span>
  )

  if (fromPaste) {
    return Loading
  }

  const otherAttrs = omit(node.attrs, 'data-refer-label')
  const Main = (
    <Resizable
      key={`${node.attrs.src}`}
      controlInit={(init) => (initRef.current = init)}
      onResize={handleResize}
      {...props}
    >
      <ZensImage
        {...otherAttrs}
        onLoad={() => initRef.current?.()}
        src={curRefer?.href || node.attrs.src}
        loader={Loading}
        imgPromise={() => {
          return new Promise(async (resolve, reject) => {
            let targetSrc = curRefer?.href || node.attrs.src || ''
            const originSrc = curRefer?.href || node.attrs.src || ''
            if (handleViewImgSrcUrl) {
              try {
                targetSrc = await handleViewImgSrcUrl(targetSrc)
              } catch (error) {}
            }

            const makeImageLoad = (targetSrc: string) => {
              const img = new Image()
              img.src = targetSrc
              img.onload = () => {
                resolve(targetSrc)
              }
              img.onerror = () => {
                if (targetSrc === originSrc) {
                  reject(warningFallBack)
                } else {
                  makeImageLoad(originSrc)
                }
              }
            }

            makeImageLoad(targetSrc)
          })
        }}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </Resizable>
  )

  return (
    <div
      ref={popoverRef}
      style={{ position: 'relative', zIndex: selected ? 10 : 'auto', lineHeight: 0 }}
    >
      <Popover
        customContent={
          <ImageToolTips
            key={`${node.attrs.src}`}
            node={node}
            referInfo={curRefer}
            imageHostingHandler={imageHostingHandler}
            updateAttributes={(...args) => {
              updateAttributes(...args)
              popoverStore.current?.setOpen(false)
            }}
          />
        }
        boxProps={{
          style: {
            display: 'inline-flex',
          },
        }}
        placement="top-start"
        onStoreChange={handleStoreChange}
        toggleOnClick
        style={{ zIndex: 11 }}
      >
        {Main}
      </Popover>
    </div>
  )
}
