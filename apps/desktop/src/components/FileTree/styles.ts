import styled from 'styled-components'

export const FileNodeStyled = styled.div`
  .file-node {
    display: flex;
    align-items: center;
    padding: 0 8px;
    height: 32px;
    box-sizing: border-box;
    font-size: 0.8rem;
    cursor: pointer;
    user-select: none;

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
      /* background-color: ${(props) => props.theme.borderColor}; */
    }
  }

  .file-icon {
    flex-shrink: 0;
  }

  .newfile-input {
    margin: 0 8px;
    border: 1px solid ${(props) => props.theme.accentColor};
  }
`

export const RootFolderTab = styled.div`
  padding: 4px 2px;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 1rem;
  color: ${(props) => props.theme.tipsFontColor};

  .arrow-icon {
    display: inline-block;
    font-size: 1.4rem;
    color: ${(props) => props.theme.primaryFontColor};
    transition: all 0.3s;

    &__down {
      transform: rotate(90deg);
    }
  }
`
