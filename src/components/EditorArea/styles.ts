import styled from 'styled-components'

export const Container = styled.div`
  .tab-items {
    height: 2rem;
    line-height: 2rem;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    overflow-x: auto;
    overflow-y: hidden;
  }

  .code-contents {
    height: calc(100% - 2rem)
  }
`

export const TabItem = styled.div<TabItemProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  border-left: 1px solid ${(props) => props.theme.borderColor};
  border-top: 1px solid ${(props) => props.theme.borderColor};
  font-size: 0.75rem;
  height: 100%;
  box-sizing: border-box;
  white-space: nowrap;

  &:last-child {
    border-right: 1px solid ${(props) => props.theme.borderColor};
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

  ${({ active, theme }) => {
    return `
      background-color: ${active ? theme.bgColor :  theme.tipsBgColor};
    `
  }}
`

interface TabItemProps {
  active: boolean
}
