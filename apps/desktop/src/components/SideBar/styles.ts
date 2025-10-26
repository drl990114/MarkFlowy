import styled from 'styled-components'

export const SideBarHeader = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 4px;
  gap: 4px;
  flex-shrink: 0;
  height: 24px;
  background-color: ${(props) => props.theme.sideBarHeaderBgColor};
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
`

export const Container = styled.div<ContainerProps>`
  flex-grow: 0;
  flex-shrink: 0;
  height: 100%;
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: row;
  background: ${(props) => props.theme.sideBarBgColor};
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
