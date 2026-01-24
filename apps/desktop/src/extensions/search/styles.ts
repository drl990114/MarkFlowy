import styled from 'styled-components'

export const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
`

export const SearchList = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
`

export const SearchInput = styled.div`
  padding: 6px 16px;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  font-size: ${({ theme }) => theme.fontBase};
  box-sizing: border-box;
  flex-shrink: 0;
  gap: 4px;
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};

  .search-input {
    flex: 1;
    background: ${({ theme }) => theme.bgColor};
    border-radius: 6px;
    border: 1px solid ${({ theme }) => theme.borderColor};
    
    &:focus-within {
      border-color: ${({ theme }) => theme.accentColor};
    }
  }
`

export const SearchInfoBox = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  font-size: 12px;
  width: 100%;

  .search-info__path {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 0 12px;
    height: 32px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    color: ${({ theme }) => theme.labelFontColor};
    background-color: ${({ theme }) => theme.bgColorSecondary};
    border-bottom: 1px solid transparent;
    transition: all 0.2s ease;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      background-color: ${({ theme }) => theme.tipsBgColor};
      color: ${({ theme }) => theme.primaryFontColor};
    }

    .search-info__icon {
      font-size: 16px;
      margin-right: 4px;
      color: ${({ theme }) => theme.labelFontColor};
      transition: transform 0.2s ease;
    }
  }

  .search-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 6px 16px;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    overflow: hidden;
    box-sizing: border-box;
    border-left: 2px solid transparent;

    &:hover {
      background-color: ${({ theme }) => theme.tipsBgColor};
    }

    &.active {
      background-color: ${({ theme }) => theme.accentColor}15; // 15% opacity
      border-left-color: ${({ theme }) => theme.accentColor};
    }

    &__linenumber {
      color: ${({ theme }) => theme.labelFontColor};
      font-weight: 500;
      margin-right: 10px;
      min-width: 24px;
      text-align: right;
      font-family: monospace;
      font-size: 11px;
      opacity: 0.8;
      margin-top: 2px;
    }

    &__content {
      flex: 1;
      overflow: hidden;
      color: ${({ theme }) => theme.primaryFontColor};
      line-height: 1.5;
      font-size: 12px;

      .snippet-text {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      mark {
        background-color: yellow;
        font-weight: bold;
        padding: 0 1px;

        &.active {
          background-color: orange;
          border-radius: 2px;
        }
      }
    }
  }
`
