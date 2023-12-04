import styled from 'styled-components'
import { Resizable } from '../Resizable'
import type { NodeViewComponentProps } from '@remirror/react'
import { Popover } from 'antd'
import { ImageToolTips } from './ImageToolTips'

const ImageEl = styled.img`
  width: 100%;
`

export function ImageNodeView(props: NodeViewComponentProps) {
  const { node, selected, updateAttributes } = props
  const { src } = node.attrs

  return (
    <Popover
      content={<ImageToolTips node={node} updateAttributes={updateAttributes} />}
      placement='topLeft'
      open={selected}
      arrow={false}
    >
      <Resizable {...props}>
        <ImageEl src={src} />
      </Resizable>
    </Popover>
  )
}
