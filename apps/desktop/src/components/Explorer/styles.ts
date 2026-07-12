import styled from 'styled-components'

export const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  user-select: none;
  overflow: auto;
  font-size: 0.8rem;

  &:hover,
  &:focus-within,
  &[data-recent-popover-open='true'] {
    .explorer-bottom {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }
  }

  .explorer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 6px;
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.2s ease-in-out,
      visibility 0.2s ease-in-out;

    &__action {
      flex: 1;
      padding: 6px 12px;
      font-size: ${(props) => props.theme.fontXs};
      border-radius: ${(props) => props.theme.smallBorderRadius};
      transition: background-color 0.2s ease-in-out;

      &:hover {
        background-color: ${(props) => props.theme.borderColor};
      }

      &__icon {
        margin-left: 8px;
        padding: 6px;
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
