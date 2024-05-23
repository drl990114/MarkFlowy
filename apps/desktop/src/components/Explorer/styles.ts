import styled from 'styled-components'

export const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  user-select: none;
  overflow: auto;
  font-size: 0.8rem;

  &:hover {
    .explorer-bottom {
      opacity: 1;
    }
  }

  .explorer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 2rem;
    padding: 0 8px;
    line-height: 2rem;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
  }

  .explorer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    opacity: 0;
    transition: all 0.3s ease-in-out;

    &__action {
      flex: 1;
      padding: 6px 12px;
      font-size: ${(props) => props.theme.fontXs};
      border-radius: ${(props) => props.theme.smallBorderRadius};
      transition: all 0.3s ease-in-out;

      &:hover {
        background-color: ${(props) => props.theme.borderColor};
      }

      &__icon {
        margin-left: 8px;
        border-radius: ${(props) => props.theme.smallBorderRadius};

        &:hover {
          background-color: ${(props) => props.theme.borderColor};
        }
      }
    }
  }

  .border-t-1-solid {
    border-top: 1px solid ${(props) => props.theme.borderColor};
  }

  .border-b-1-solid {
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
  }
`
