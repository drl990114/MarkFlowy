import styled from 'styled-components'

export const Container = styled.div`
  position: relative;
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

    ::-webkit-scrollbar {
      display: none;
    }

    &__icon {
      margin: 0 2px;
    }
  }

  .editor-area-header {
    padding: 8px;
    position: absolute;
    right: 6px;
    top: 28px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    box-sizing: border-box;
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
  cursor: pointer;
  user-select: none;

  &:first-child {
    border-left: none;
  }

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

type DotProps = {
  color?: string
}

export const Dot = styled.div<DotProps>`
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background-color: ${(props) => props.color || props.theme.labelFontColor};
  margin: 0 0.25rem;
`

interface TabItemProps {
  active: boolean
}
