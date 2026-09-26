import styled from 'styled-components'

interface SettingGroupContainerProps {
  $anchorId?: string
}

export const SettingGroupContainer = styled.div.attrs<SettingGroupContainerProps>((props) => ({
  id: props.$anchorId,
  tabIndex: props.$anchorId ? -1 : undefined,
}))`
  padding: 0;
  margin: 0 0 24px;
  min-width: 0;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  box-sizing: border-box;
  scroll-margin-top: 24px;

  &:focus-visible {
    outline: none;

    > .setting-group__title {
      text-decoration-line: underline;
      text-underline-offset: 2px;
    }
  }

  .setting-group {
    &__title {
      margin: 0 0 8px;
      padding: 0 12px;
      font-size: var(--mf-ui-font-body);
      line-height: var(--mf-ui-line-height-body);
      font-weight: 600;
      color: ${(props) => props.theme.primaryFontColor};
    }

    &__items {
      min-width: 0;
      padding: 0 12px;
      border-radius: var(--mf-radius);
      background-color: color-mix(in srgb, var(--mf-surface-panel) 75%, var(--mf-background));
    }
  }
`
