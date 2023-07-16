import { useHelpers } from '@remirror/react'
import styled from 'styled-components'

const Container = styled.div`
  position: fixed;
  right: 0;
  bottom: 0;
  padding: 8px;
  z-index: 2;
  font-size: 12px;
  border-style: solid;
  border-width: 2px 0 0 2px;
  border-radius: 8px 0 0 0;
  border-color: ${props => props.theme.borderColor};
  color: ${props => props.theme.labelFontColor};
  background-color: ${props => props.theme.tipsBgColor};
  user-select: none;
  cursor: default;
`

export const EditorCount = () => {
  const { getCharacterCount, getWordCount } = useHelpers(true)

  const characterCount = getCharacterCount()
  const wordCount = getWordCount()

  return (
    <Container>
      {wordCount} words {characterCount} characters
    </Container>
  )
}
