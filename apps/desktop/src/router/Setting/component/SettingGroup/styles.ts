import styled from 'styled-components'

export const SettingGroupContainer = styled.div`
  padding: 18px 22px 2px;
  margin: 0 0 28px;
  min-width: 0;
  font-size: 0.875rem;
  background-color: var(--mf-card);
  border: 1px solid var(--mf-border);
  box-sizing: border-box;
  border-radius: var(--mf-radius-lg);

  .setting-group {
    &__title {
      margin: 0;
      padding: 2px 2px 12px;
      font-size: 15px;
      font-weight: 600;
      color: ${(props) => props.theme.primaryFontColor};
      letter-spacing: 0.2px;
    }
  }
`
