import styled from 'styled-components'

export const RightBarHeader = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-shrink: 0;
  height: 32px;
  background-color: ${(props) => props.theme.rightBarHeaderBgColor};
`

export const Container = styled.div`
  flex-grow: 0;
  flex-shrink: 0;
  height: 100%;
  width: 100%;
  position: relative;
  background: ${(props) => props.theme.rightBarBgColor};
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
