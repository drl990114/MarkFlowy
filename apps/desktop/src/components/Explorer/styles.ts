import styled from 'styled-components'

export const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 8px;
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
    padding: 4px;
    padding-left: 8px;
    border-top: 1px solid ${(props) => props.theme.borderColor};
    opacity: 0;
    transition: all 0.3s ease-in-out;
  }

  .border-t-1-solid {
    border-top: 1px solid ${(props) => props.theme.borderColor};
  }

  .border-b-1-solid {
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
  }
`
