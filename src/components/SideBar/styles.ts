import styled from 'styled-components'
import colors from 'windicss/colors'

export const Container = styled.div<ContainerProps>`
  flex-grow: 0;
  flex-shrink: 0;
  max-width: 400px;
  position: relative;
  display: flex;
  border-right: #e9e9e9 1px solid;
  flex-direction: row;
  background: #ffffff;
  box-shadow: -8px 2px 22px -7px rgba(0, 0, 0, 0.25);
  border-radius: 10px 0px 0px 10px;
  z-index: 2;

  .app-sidebar {
    border-right: 1px solid ${colors.zinc[200]};
  }

  .app-sidebar-active {
    border-left: 4px solid ${colors.sky[700]};
  }

  .app-sidebar-content {
    min-width: calc(100% - 48px);
  }

  .app-sidebar-resizer {
    flex-grow: 0;
    flex-shrink: 0;
    flex-basis: 1px;
    justify-self: flex-end;
    cursor: col-resize;
    resize: horizontal;
  }

  .app-sidebar-resizer:hover {
    flex-basis: 3px;
    background: #c1c3c5b4;
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
