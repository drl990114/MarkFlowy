import styled from 'styled-components'

export const Container = styled.div`
  position: relative;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;

  .tab-items {
    display: flex;
    flex: 0 0 2rem;
    line-height: 2rem;
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
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: auto;
    scroll-behavior: smooth;
  }
`

export const TabItem = styled.div<TabItemProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.75rem;
  height: calc(100% + 2px);
  box-sizing: border-box;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;

  .close {
    cursor: pointer;
    opacity: 0;
  }

  &:hover {
    .close {
      opacity: 1;
    }
  }
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


export const WarningHeader = styled.h3`
  text-align: center;
  color: ${(props) => props.theme.warnColor};
`
