import styled from 'styled-components'

export const SettingGroupContainer = styled.div`
  padding: 1rem;
  margin: 20px 0;
  font-size: 0.875rem;
  background-color: ${(props) => props.theme.tipsBgColor};
  box-sizing: border-box;

  .setting-group {
    &__title {
      margin-bottom: 20px;
      font-size: 14px;
      font-weight: 600;
    }
  }
`
