import styled from 'styled-components'

interface SettingGroupContainerProps {
  $anchorId?: string
}

export const SettingGroupContainer = styled.div.attrs<SettingGroupContainerProps>((props) => ({
  id: props.$anchorId,
  tabIndex: props.$anchorId ? -1 : undefined,
}))`
  padding: 10px 16px 0;
  margin: 0 0 16px;
  min-width: 0;
  font-size: var(--mf-ui-font-body);
  line-height: var(--mf-ui-line-height-body);
  background-color: var(--mf-card);
  border: 1px solid var(--mf-border);
  box-sizing: border-box;
  border-radius: var(--mf-radius);
  scroll-margin-top: 24px;

  &:focus {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 2px;
  }

  .setting-group {
    &__title {
      margin: 0;
      padding: 2px 0 7px;
      font-size: var(--mf-ui-font-body);
      line-height: var(--mf-ui-line-height-body);
      font-weight: 600;
      color: ${(props) => props.theme.primaryFontColor};
    }
  }
`
