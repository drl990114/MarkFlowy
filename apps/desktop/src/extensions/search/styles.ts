import styled from 'styled-components'

export const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.sideBarBgColor};
`

export const SearchList = styled.div`
  position: relative;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: ${({ theme }) => theme.bgColor};
`

export const SearchInput = styled.div`
  position: relative;
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  font-size: ${({ theme }) => theme.fontBase};
  box-sizing: border-box;
  flex-shrink: 0;
  gap: 6px;
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  background: ${({ theme }) => theme.sideBarBgColor};

  .search-input {
    flex: 1;
    background: ${({ theme }) => theme.bgColor};
    border-radius: 6px;
    border: 1px solid ${({ theme }) => theme.borderColor};
    
    &:focus-within {
      border-color: ${({ theme }) => theme.accentColor};
    }
  }

  .search-input__action {
    flex-shrink: 0;
  }

  .search-input__progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    overflow: hidden;
    background: ${({ theme }) => `${theme.accentColor}18`};

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -35%;
      width: 35%;
      height: 100%;
      border-radius: 999px;
      background: ${({ theme }) => theme.accentColor};
      animation: search-progress 1.1s ease-in-out infinite;
    }
  }

  .ri-loader-4-line {
    animation: search-spin 0.9s linear infinite;
  }

  @keyframes search-progress {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(385%);
    }
  }

  @keyframes search-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

export const SearchMeta = styled.div`
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  box-sizing: border-box;
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  color: ${({ theme }) => theme.labelFontColor};
  font-size: 12px;
  background: ${({ theme }) => theme.bgColorSecondary};

  .search-meta__content {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`

export const SearchStateBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 180px;
  padding: 24px 18px;
  box-sizing: border-box;
  text-align: center;
  color: ${({ theme }) => theme.labelFontColor};
  font-size: 12px;
  line-height: 1.5;

  .search-state__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: ${({ theme }) => theme.accentColor};
    background: ${({ theme }) => `${theme.accentColor}12`};
    font-size: 18px;
  }

  .ri-loader-4-line {
    animation: search-state-spin 0.9s linear infinite;
  }

  @keyframes search-state-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .search-state__title {
    color: ${({ theme }) => theme.primaryFontColor};
    font-weight: 600;
  }

  .search-state__desc {
    max-width: 220px;
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
    gap: 5px;
    padding: 0 10px;
    height: 34px;
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
      background-color: ${({ theme }) => theme.bgColor};
      color: ${({ theme }) => theme.primaryFontColor};
    }

    .search-info__icon {
      font-size: 16px;
      color: ${({ theme }) => theme.labelFontColor};
      transition: transform 0.2s ease;
    }

    .search-info__file-icon {
      flex-shrink: 0;
      font-size: 14px;
      opacity: 0.72;
    }

    .search-info__path-text {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .search-info__badge {
      flex-shrink: 0;
      min-width: 18px;
      padding: 1px 6px;
      border-radius: 999px;
      color: ${({ theme }) => theme.labelFontColor};
      background: ${({ theme }) => theme.tipsBgColor};
      font-size: 11px;
      font-weight: 600;
      text-align: center;
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
    background: ${({ theme }) => theme.bgColor};

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
      min-width: 44px;
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
        color: ${({ theme }) => theme.primaryFontColor};
        background-color: ${({ theme }) => `${theme.accentColor}38`};
        font-weight: bold;
        padding: 0 1px;
        border-radius: 2px;

        &.active {
          color: ${({ theme }) => theme.bgColor};
          background-color: ${({ theme }) => theme.accentColor};
        }
      }
    }
  }
`
