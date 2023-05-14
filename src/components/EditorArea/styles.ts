import customColors from '@/colors'
import styled, { css } from 'styled-components'

export const Container = styled.div`
  .tab-items {
    border-bottom: 1px solid ${customColors.borderColor};
  }
`

export const TabItem = styled.div<TabItemProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  border-left: 1px solid ${customColors.borderColor};
  border-top: 1px solid ${customColors.borderColor};
  font-size: 0.8rem;
  box-sizing: border-box;

  &:last-child {
    border-right: 1px solid ${customColors.borderColor};
  }

  .close {
    cursor: pointer;
    opacity: 0;
  }

  &:hover {
    .close {
      opacity: 1;
    }
  }

  ${({ active }) => {
    return `
      background-color: ${active ? customColors.bgColor : customColors.tipsBgColor};
    `
  }}
`

interface TabItemProps {
  active: boolean
}
