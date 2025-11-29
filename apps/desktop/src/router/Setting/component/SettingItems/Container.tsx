import styled from "styled-components"

interface SettingItemContainerProps {
  $direction?: 'row' | 'column'
}

export const SettingItemContainer = styled.div<SettingItemContainerProps>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;

  ${(props) => props.$direction === 'column' && `
    flex-direction: column;
  `}

  .setting-item__slider {
    width: 120px;
    box-sizing: border-box;
  }
`
