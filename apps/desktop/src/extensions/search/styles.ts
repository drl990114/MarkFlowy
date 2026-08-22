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

    &:focus-within {
      border-color: ${({ theme }) => theme.accentColor};
    }
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
  padding: 0 6px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--mf-ui-border-subtle);
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

export const SearchInfoBox = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  width: 100%;

  .search-info__path {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 0 6px;
    border: 0;
    height: 24px;
    font-size: var(--mf-ui-font-control);
    line-height: var(--mf-ui-line-height-control);
    letter-spacing: var(--mf-ui-tracking-control);
    font-weight: 500;
    cursor: pointer;
    color: var(--mf-text-muted, ${({ theme }) => theme.unselectedFontColor});
    background-color: transparent;
    border-bottom: 1px solid transparent;
    transition:
      color 100ms ease,
      background-color 100ms ease;
    user-select: none;
    font-family: inherit;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      background-color: var(--mf-control-ghost-hover, ${({ theme }) => theme.hoverColor});
      color: ${({ theme }) => theme.primaryFontColor};
    }

    &:active {
      background-color: var(--mf-control-ghost-pressed, ${({ theme }) => theme.hoverColor});
    }

    &:focus-visible {
      outline: 1px solid var(--mf-control-focus, ${({ theme }) => theme.accentColor});
      outline-offset: -2px;
    }

    .search-info__icon {
      flex: 0 0 14px;
      color: var(--mf-text-muted, ${({ theme }) => theme.unselectedFontColor});
      transition: transform var(--mf-motion-duration-base, 180ms)
        var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
    }

    .search-info__icon--expanded {
      transform: rotate(90deg);
    }

    .search-info__file-icon {
      flex-shrink: 0;
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
      min-width: 16px;
      padding: 0 2px;
      border-radius: 2px;
      color: var(--mf-text-muted, ${({ theme }) => theme.unselectedFontColor});
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
    align-items: center;
    width: 100%;
    min-height: 32px;
    padding: 4px 6px 4px 24px;
    border-top: 0;
    border-right: 0;
    border-bottom: 0;
    cursor: pointer;
    transition:
      background-color 100ms ease,
      border-color 100ms ease;
    overflow: hidden;
    box-sizing: border-box;
    border-left: 0;
    background: transparent;
    color: inherit;
    font-family: inherit;
    text-align: left;

    &:hover {
      background-color: var(--mf-control-ghost-hover, ${({ theme }) => theme.hoverColor});
    }

    &:active {
      background-color: var(--mf-control-ghost-pressed, ${({ theme }) => theme.hoverColor});
    }

    &:focus-visible {
      outline: 1px solid var(--mf-control-focus, ${({ theme }) => theme.accentColor});
      outline-offset: -2px;
    }

    &.active {
      background-color: var(--mf-control-selected, ${({ theme }) => theme.accentColorFocused});
    }

    &__linenumber {
      color: var(--mf-text-muted, ${({ theme }) => theme.unselectedFontColor});
      font-weight: 500;
      margin-right: 8px;
      min-width: 40px;
      text-align: right;
      font-family: monospace;
      font-size: var(--mf-ui-font-caption);
      line-height: var(--mf-ui-line-height-caption);
      opacity: 0.8;
      margin-top: 0;
    }

    &__content {
      flex: 1;
      overflow: hidden;
      color: ${({ theme }) => theme.primaryFontColor};
      line-height: var(--mf-ui-line-height-control);
      font-size: var(--mf-ui-font-control);

      .snippet-text {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      mark {
        color: ${({ theme }) => theme.primaryFontColor};
        background-color: color-mix(
          in srgb,
          var(--mf-control-focus, ${({ theme }) => theme.accentColor}) 22%,
          transparent
        );
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

  @media (prefers-reduced-motion: reduce) {
    .search-info__path,
    .search-info,
    .search-info__icon {
      transition: none;
    }
  }
`
