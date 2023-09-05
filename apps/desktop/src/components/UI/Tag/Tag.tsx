import styled from 'styled-components'

interface TagProps {
  color?: string
}
export const Tag = styled.span<TagProps>`
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  list-style: none;
  background-color: ${(props) => props.color || '#eee'};
  color: #666;
`
