import styled from 'styled-components'

export const Container = styled.div`
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;

  .tab-items {
    display: flex;
    flex: 0 0 2rem;
    line-height: 2rem;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    overflow-x: auto;
    overflow-y: hidden;

    &__icon {
      margin: 0 2px;
    }
  }

  .code-contents {
    width: 100%;
    flex: 1;
    overflow: auto;
    height: 100%;
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
      background-color: ${active ? theme.bgColor : theme.tipsBgColor};
    `
  }}
`

interface TabItemProps {
  active: boolean
}
