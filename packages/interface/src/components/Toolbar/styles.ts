import styled from 'styled-components'

export const ToolbarWrapper = styled.div`
  background-color: ${({ theme }) => theme.bgColor};
  width: 100%;
  padding: 4px 8px;
  border-bottom: 1px solid
    ${({ theme }) => `color-mix(in srgb, ${theme.borderColor} 72%, transparent)`};
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: nowrap;
  overflow: hidden;
  box-sizing: border-box;
`

export const ToolbarDivider = styled.div`
  width: 1px;
  height: 20px;
  background-color: ${({ theme }) =>
    `color-mix(in srgb, ${theme.borderColor} 72%, transparent)`};
  margin: 0 4px;
  flex-shrink: 0;
`
