import { useRemirrorContext } from '@remirror/react-core'
import type { EditorContext } from '..'
import { useEffect } from 'react'

export const useContextMounted = (onContextMounted?: (ctx: EditorContext) => void ) => {
  const remirrorContext = useRemirrorContext()


  useEffect(() => {
    if (onContextMounted) {
      onContextMounted(remirrorContext)
    }
  }, [onContextMounted, remirrorContext])
}
