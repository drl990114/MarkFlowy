import styled from 'styled-components'

export const FileNodeStyled = styled.div`
  .file-node {
    display: flex;
    align-items: center;
    padding: 0 8px;
    height: 32px;
    box-sizing: border-box;
    cursor: pointer;

    &__text {
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }

    &:hover {
      color: ${(props) => props.theme.accentColor};
      background-color: ${(props) => props.theme.borderColor};
    }

    &--active {
      color: ${(props) => props.theme.accentColor};
      background-color: ${(props) => props.theme.borderColor};
    }
  }

  .file-icon {
    flex-shrink: 0;
  }
`
