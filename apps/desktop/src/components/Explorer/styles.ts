import styled from 'styled-components'

export const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  min-width: calc(100% - 48px);
  user-select: none;

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
    padding: 4px;
    padding-left: 8px;
    border-top: 1px solid ${(props) => props.theme.borderColor};
    opacity: 0;
    transition: all .3s ease-in-out;

    &:hover {
      opacity: 1;
    }
  }

  .border-t-1-solid {
    border-top: 1px solid ${(props) => props.theme.borderColor};
  }

  .border-b-1-solid {
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
  }
`
