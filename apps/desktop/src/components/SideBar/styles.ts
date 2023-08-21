import styled from 'styled-components'

type SideBarProps = {
  visible: boolean
}

export const SideBar = styled.div<SideBarProps>`
  display: ${(props) => (props.visible ? 'flex' : 'none')};
  flex-direction: column;
  flex-shrink: 0;
  justify-content: space-between;
  width: 48px;
  border-right: 1px solid ${(props) => props.theme.borderColor};
`

export const Container = styled.div<ContainerProps>`
  flex-grow: 0;
  flex-shrink: 0;
  max-width: 400px;
  position: relative;
  display: flex;
  border-right: 1px solid ${(props) => props.theme.borderColor};
  flex-direction: row;
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  box-shadow: -8px 2px 22px -7px rgba(0, 0, 0, 0.25);
  border-radius: 10px 0px 0px 10px;
  z-index: 2;

  .app-sidebar {
    &__item {
      width: 48px;
      height: 48px;
      cursor: pointer;
      font-size: 26px;
    }

    &-active {
      border-left: 4px solid ${(props) => props.theme.accentColor};
    }

    &-content {
      overflow: hidden;
    }

    &-resizer {
      position: absolute;
      height: 100%;
      width: 1px;
      right: -1px;
      cursor: col-resize;
      resize: horizontal;
      background: ${(props) => props.theme.borderColor};
    }
    &-resizer:hover {
      width: 3px;
      background: ${(props) => props.theme.labelFontColor};
    }
  }

  ${(props) => (props.noActiveItem ? 'width: 48px' : 'min-width: 150px')}
`

interface ContainerProps {
  noActiveItem: boolean
}

export const SettingRightBarContainer = styled.div`
  position: relative;

  &:hover {
    .menu {
      display: inline-block;
    }
  }

  .menu {
    position: absolute;
    right: -200px;
    bottom: 10px;
    width: 200px;
    display: none;
  }
`
