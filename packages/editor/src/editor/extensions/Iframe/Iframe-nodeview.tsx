import type { NodeViewComponentProps } from '@rme-sdk/sdk/react'
import { useCallback, useRef } from 'react'
import { Popover } from 'zens'
import { Resizable } from '../../components/Resizable'

export function IframeNodeView(props: NodeViewComponentProps) {
  const { node, selected } = props
  const initRef = useRef<(() => void) | undefined>(undefined)
  const handleControlInit = useCallback((init: () => void) => {
    initRef.current = init
  }, [])

  return (
    <Popover placement='top-start' open={selected} arrow={false}>
      <Resizable controlInit={handleControlInit} {...props}>
        <iframe onLoad={() => initRef.current?.()} {...node.attrs} />
      </Resizable>
    </Popover>
  )
}
