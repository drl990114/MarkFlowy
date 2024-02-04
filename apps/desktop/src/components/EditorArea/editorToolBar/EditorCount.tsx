import { useHelpers } from 'rme'
import styled from 'styled-components'

const Container = styled.div`
  position: fixed;
  right: 0;
  bottom: 0;
  padding: 8px 12px 8px 8px;
  z-index: 2;
  opacity: 0.3;
  font-size: 0.9rem;
  user-select: none;
  box-sizing: border-box;
  cursor: default;
`

export const EditorCount = () => {
  const { getCharacterCount, getWordCount } = useHelpers(true)

  const characterCount = getCharacterCount()
  const wordCount = getWordCount()

  return (
    <Container>
      {wordCount} words {characterCount} chars
    </Container>
  )
}
