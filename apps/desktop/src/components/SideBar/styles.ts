import styled from 'styled-components'

export const SideBarHeader = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 4px;
  gap: 4px;
  flex-shrink: 0;
  height: 32px;
  box-sizing: border-box;
  background-color: ${(props) => props.theme.sideBarHeaderBgColor};
  border-bottom: 1px solid var(--mf-ui-border-subtle);
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
      appearance: none;
      padding: 0;
      border: 0;
      width: 22px;
      height: 22px;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      color: ${(props) => props.theme.labelFontColor};
      background: transparent;
      border-radius: 5px;
      transition:
        color 100ms ease,
        background-color 100ms ease,
        box-shadow 100ms ease;

      &:hover {
        color: ${(props) => props.theme.primaryFontColor};
        background-color: var(--mf-ui-control-hover-bg);
      }

      &[aria-pressed='true'] {
        color: ${(props) => props.theme.primaryFontColor};
        background-color: color-mix(
          in srgb,
          var(--mf-ui-control-selected-bg) 62%,
          transparent
        );
      }

      &:focus-visible {
        outline: 2px solid ${(props) => props.theme.accentColor};
        outline-offset: -2px;
      }
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
