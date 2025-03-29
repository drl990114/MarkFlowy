import styled from 'styled-components'

export const SettingGroupContainer = styled.div`
  padding: 1rem;
  margin: 16px 0;
  font-size: 0.875rem;
  background-color: ${(props) => props.theme.bgColorSecondary};
  box-sizing: border-box;
  border-radius: 6px;
  transition: background-color 0.3s ease;

  .setting-group {
    &__title {
      margin-bottom: 24px;
      font-size: 15px;
      font-weight: 600;
      color: ${(props) => props.theme.primaryFontColor};
      letter-spacing: 0.2px;
    }
  }
`
