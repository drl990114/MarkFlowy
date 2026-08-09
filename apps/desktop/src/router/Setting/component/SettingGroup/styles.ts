import styled from 'styled-components'

export const SettingGroupContainer = styled.div`
  padding: 10px 16px 0;
  margin: 0 0 16px;
  min-width: 0;
  font-size: 0.875rem;
  background-color: var(--mf-card);
  border: 1px solid var(--mf-border);
  box-sizing: border-box;
  border-radius: var(--mf-radius);

  .setting-group {
    &__title {
      margin: 0;
      padding: 2px 0 7px;
      font-size: 13px;
      font-weight: 600;
      color: ${(props) => props.theme.primaryFontColor};
    }
  }
`
