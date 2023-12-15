import styled from 'styled-components'
import type { NodeViewComponentProps } from '@remirror/react'
import { Popover } from '@markflowy/components'
import { ImageToolTips } from './image-tool-tips'
import { Resizable } from '@/components/Resizable'

const ImageEl = styled.img`

`

export function ImageNodeView(props: NodeViewComponentProps) {
  const { node, selected, updateAttributes } = props

  return (
    <Popover
      customContent={<ImageToolTips node={node} updateAttributes={updateAttributes} />}
      placement='top-start'
      open={selected}
      arrow={false}
    >
      <Resizable {...props}>
        <ImageEl {...node.attrs} />
      </Resizable>
    </Popover>
  )
}
