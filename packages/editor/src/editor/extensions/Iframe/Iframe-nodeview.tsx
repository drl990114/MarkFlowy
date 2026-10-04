import type { NodeViewComponentProps } from '@rme-sdk/sdk/react'
import { useCallback, useRef } from 'react'
import { Resizable } from '../../components/Resizable'

export function IframeNodeView(props: NodeViewComponentProps) {
  const { node } = props
  const initRef = useRef<(() => void) | undefined>(undefined)
  const handleControlInit = useCallback((init: () => void) => {
    initRef.current = init
  }, [])

  return (
    <Resizable controlInit={handleControlInit} {...props}>
      <iframe onLoad={() => initRef.current?.()} {...node.attrs} />
    </Resizable>
  )
}
