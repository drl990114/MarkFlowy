import styled from 'styled-components'

export const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
`

export const SearchInput = styled.div`
  position: sticky;
  top: 0;
  padding: 8px;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  font-size: ${({ theme }) => theme.fontBase};
  background-color: ${({ theme }) => theme.bgColor};
  box-sizing: border-box;

  .search-input {
    flex: 1;
    padding: 0.2rem;
    margin-right: 4px;
  }
`

export const SearchInfoBox = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  font-size: 12px;

  .search-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 8px 16px;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
    overflow: hidden;
    box-sizing: border-box;

    &:hover {
      background-color: ${({ theme }) => theme.tipsBgColor};
    }

    &__icon {
      font-size: 18px;
    }

    &__path {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding: 0 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;

      &:hover {
        background-color: ${({ theme }) => theme.tipsBgColor};
      }
    }

    &__linenumber {
      color: ${({ theme }) => theme.labelFontColor};
      font-weight: 500;
      margin-right: 8px;
    }

    &__content {
      flex: 1;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
`
