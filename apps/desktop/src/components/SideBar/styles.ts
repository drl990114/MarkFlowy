import styled from 'styled-components'

export const SideBarHeader = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-shrink: 0;
`

export const Container = styled.div<ContainerProps>`
  flex-grow: 0;
  flex-shrink: 0;
  max-width: 400px;
  position: relative;
  display: flex;
  flex-direction: row;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  overflow: hidden;

  .app-sidebar {
    &__item {
      width: 20px;
      height: 20px;
      cursor: pointer;
      font-size: 16px;
    }

    &-active {
      color: ${(props) => props.theme.accentColor};
    }

    &-content {
      overflow: hidden;
    }

    &-resizer {
      position: absolute;
      height: 100%;
      width: 1px;
      right: 1px;
      cursor: col-resize;
      resize: horizontal;
      background: transparent;
    }

    &-resizer:hover {
      width: 3px;
      background: ${(props) => props.theme.labelFontColor};
    }
  }
`

interface ContainerProps {
  noActiveItem: boolean
}
