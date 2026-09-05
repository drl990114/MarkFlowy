import { commandRegistry } from '@/commands'
import { useEditorStore } from '@/stores'
import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import styled from 'styled-components'
import { getCapricornEditor, subscribeCapricornEditors } from '../../capricornEditorRegistry'
import { CapricornFindReplaceComponent, FindReplaceComponent } from './find-replace-component'

function useFindReplaceOpen() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: 'app_findReplaceEditor',
      handler: () => {
        setOpen((prev) => {
          commandRegistry.execute('app_stopFindEditor')
          return !prev
        })
      },
    })

    return () => disposable.dispose()
  }, [])

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
  background-color: ${({ theme }) => theme.bgColor};
  backdrop-filter: blur(8px);
  width: '100%';
  padding: 8px;
`

export const FindReplace: FC = () => {
  const { open, ref, close } = useFindReplaceOpen()
  const activeId = useEditorStore((state) => state.activeId)
  const editorCtx = useEditorStore((state) => state.editorCtxMap.get(activeId ?? ''))
  const getCapricornSnapshot = useCallback(
    () => (activeId ? getCapricornEditor(activeId) : undefined),
    [activeId],
  )
  const capricornEditor = useSyncExternalStore(
    subscribeCapricornEditors,
    getCapricornSnapshot,
    getCapricornSnapshot,
  )

  if (!open) return null

  if (capricornEditor) {
    return (
      <FindReplaceWrapper ref={ref}>
        <CapricornFindReplaceComponent editor={capricornEditor} onDismiss={close} />
      </FindReplaceWrapper>
    )
  }

  if (!editorCtx?.helpers.findRanges) return null

  return (
    <FindReplaceWrapper ref={ref}>
      <FindReplaceComponent onDismiss={close} editorCtx={editorCtx} />
    </FindReplaceWrapper>
  )
}
