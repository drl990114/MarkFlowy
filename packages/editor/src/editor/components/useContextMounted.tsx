import { useRemirrorContext } from '@rme-sdk/react-core'
import { useEffect } from 'react'
import { EditorContext } from '../types'

export const useContextMounted = (onContextMounted?: (ctx: EditorContext) => void) => {
  const remirrorContext = useRemirrorContext()

  useEffect(() => {
    if (onContextMounted) {
      onContextMounted(remirrorContext)
    }
  }, [onContextMounted, remirrorContext])
}
