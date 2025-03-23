import { useEditorStore } from '@/stores'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import styled from 'styled-components'

const Container = styled.div`
  position: fixed;
  right: 0;
  bottom: 0;
  padding: 8px 12px 8px 8px;
  z-index: 2;
  opacity: 0.5;
  font-size: 0.85rem;
  user-select: none;
  box-sizing: border-box;
  cursor: default;
`

export const EditorCount = () => {
  const { editorCounterMap } = useEditorCounterStore()
  const { activeId } = useEditorStore()

  if (!activeId) {
    return null
  }

  const counter = editorCounterMap[activeId]

  if (!counter) {
    return null
  }

  const { wordCount, characterCount } = counter

  return (
    <Container>
      {wordCount} words {characterCount} chars
    </Container>
  )
}
