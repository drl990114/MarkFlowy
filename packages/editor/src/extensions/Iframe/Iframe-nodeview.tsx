import styled from 'styled-components'
import type { NodeViewComponentProps } from '@remirror/react'
import { Popover } from '@markflowy/components'
import { Resizable } from '@/components/Resizable'

const IframeEl = styled.iframe`

`

export function IframeNodeView(props: NodeViewComponentProps) {
  const { node, selected } = props

  return (
    <Popover placement='top-start' open={selected} arrow={false}>
      <Resizable {...props}>
        <IframeEl {...node.attrs}/>
      </Resizable>
    </Popover>
  )
}
