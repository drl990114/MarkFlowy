import { useCommandStore, useEditorStore } from '@/stores'
import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { FindReplaceComponent } from './find-replace-component'

function useFindReplaceOpen() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { addCommand, execute } = useCommandStore()
  
  useEffect(() => {
    addCommand({
      id: 'app_findReplaceEditor',
      handler: () => {
        setOpen((prev) => {
          if (!prev) {
            execute('app_stopFindEditor')
          }
          return !prev
        })
      }
    })
  }, [addCommand, execute])

  const focus = useCallback(() => {
    const input = ref.current?.querySelector('input')
    if (input && document.activeElement !== input) {
      input.focus()
      return true
    }
    return false
  }, [])

  useEffect(() => {
    if (open) {
      focus()
    }
  }, [focus, open])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return { open, ref, close }
}

const FindReplaceWrapper = styled.div`
  position: sticky;
  left: 0;
  right: 0;
  top: 200;
  z-index: 1000000;
  background-color: ${({ theme }) => theme.bgColor};
  backdrop-filter: blur(8px);
  width: '100%';
  padding: 8px;
`

export const FindReplace: FC = () => {
  const { open, ref, close } = useFindReplaceOpen()
  const { editorCtxMap, activeId } = useEditorStore()

  const editorCtx = editorCtxMap.get(activeId ?? '')

  if (!open || !editorCtx || !editorCtx.helpers.findRanges) return null

  return (
      <FindReplaceWrapper ref={ref}>
        <FindReplaceComponent onDismiss={close} editorCtx={editorCtx} />
      </FindReplaceWrapper>
  )
}
