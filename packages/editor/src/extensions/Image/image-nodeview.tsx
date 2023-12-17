import type { NodeViewComponentProps } from '@remirror/react'
import { Popover } from '@markflowy/components'
import { ImageToolTips } from './image-tool-tips'
import { Resizable } from '@/components/Resizable'
import { useEffect, useRef, useState } from 'react'
import type { ExtensionsOptions } from '..'

export interface ImageNodeViewProps extends NodeViewComponentProps {
  handleViewImgSrcUrl?: ExtensionsOptions['handleViewImgSrcUrl']
}
export function ImageNodeView(props: ImageNodeViewProps) {
  const { node, selected, updateAttributes, handleViewImgSrcUrl } = props
  const [src, setSrc] = useState<string>('')
  const initRef = useRef<() => void>()

  useEffect(() => {
    if (handleViewImgSrcUrl) {
      handleViewImgSrcUrl(node.attrs.src).then((newSrc) => {
        setSrc(newSrc)
      })
    } else {
      setSrc(node.attrs.src)
    }
  }, [handleViewImgSrcUrl, node.attrs.src])

  return (
    <Popover
      customContent={<ImageToolTips node={node} updateAttributes={updateAttributes} />}
      placement='top-start'
      open={selected}
      arrow={false}
    >
      <Resizable controlInit={(init) => (initRef.current = init)} {...props}>
        {src ? <img onLoad={() => initRef.current?.()} {...node.attrs} src={src} /> : null}
      </Resizable>
    </Popover>
  )
}
