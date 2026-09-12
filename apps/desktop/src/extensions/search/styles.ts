import styled from 'styled-components'

export const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.sideBarBgColor};
`

export const SearchList = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--mf-surface-panel, ${({ theme }) => theme.sideBarBgColor});
`

export const SearchInput = styled.div`
  position: relative;
  display: flex;
  flex: 0 0 32px;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  min-height: 32px;
  padding: 4px 6px;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  box-sizing: border-box;
  flex-shrink: 0;
  gap: 2px;
  border-bottom: 1px solid var(--mf-ui-border-subtle);
  background: var(--mf-surface-panel, ${({ theme }) => theme.sideBarBgColor});

  .search-input {
    flex: 1;
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--mf-control-border, ${({ theme }) => theme.borderColor});
    border-radius: 4px;
    background: transparent;
    box-shadow: none;
  }

  .search-input__progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    overflow: hidden;
    background: color-mix(
      in srgb,
      var(--mf-control-focus, ${({ theme }) => theme.accentColor}) 9%,
      transparent
    );

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

  .search-icon--spin {
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

  @media (prefers-reduced-motion: reduce) {
    .search-input__progress::after {
      left: 0;
      width: 100%;
      animation: none;
      opacity: 0.55;
    }

    .search-icon--spin {
      animation: none;
    }
  }
`

export const SearchMeta = styled.div`
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  box-sizing: border-box;
  color: var(--mf-text-muted, ${({ theme }) => theme.unselectedFontColor});
  font-size: var(--mf-ui-font-caption);
  line-height: var(--mf-ui-line-height-caption);
  letter-spacing: var(--mf-ui-tracking-caption);
  background: var(--mf-surface-panel, ${({ theme }) => theme.sideBarBgColor});

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
  color: var(--mf-text-muted, ${({ theme }) => theme.unselectedFontColor});
  font-size: var(--mf-ui-font-body);
  line-height: var(--mf-ui-line-height-body);
  letter-spacing: var(--mf-ui-tracking-body);

  .search-state__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--mf-text-muted, ${({ theme }) => theme.unselectedFontColor});
  }

  .search-icon--spin {
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

  @media (prefers-reduced-motion: reduce) {
    .search-icon--spin {
      animation: none;
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
