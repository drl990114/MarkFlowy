import styled from 'styled-components'

export const Container = styled.div`
  position: relative;
  top: 0;
  left: 0;
  right: 0;
  padding: 4px 6px 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${(props) => props.theme.spaceSm};
  height: var(--mf-ui-status-bar-height);
  box-sizing: border-box;
  background: ${(props) => props.theme.statusBarBgColor};
  border-top: 1px solid var(--mf-ui-border-subtle);
  user-select: none;
  font-size: var(--mf-ui-font-caption);
  line-height: var(--mf-ui-line-height-caption);
  letter-spacing: var(--mf-ui-tracking-caption);
  overflow: hidden;

  & .mf-dock-switcher {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
    height: 100%;
  }

  & .mf-dock-switcher__button {
    color: var(--mf-text-secondary);
  }

  & .mf-dock-switcher__button:hover,
  & .mf-dock-switcher__button:active {
    color: var(--mf-text-primary);
  }

  & .mf-dock-switcher__button[aria-pressed='true'] > svg {
    color: var(--mf-primary);
  }

  @media (max-width: 719px) {
    padding: 3px 6px 4px;

    & [data-mf-status-bar-button] {
      height: 24px;
      min-width: 24px;
    }

    & [data-mf-status-bar-format='icon'] {
      width: 24px;
      padding-inline: 0;
    }
  }

  @media (max-width: 299px) {
    padding: 3px 4px 4px;
    gap: 2px;

    & .mf-dock-switcher {
      gap: 1px;
    }
  }

  @media (max-width: 229px) {
    padding: 3px 2px 4px;
    gap: 1px;

    & .mf-dock-switcher {
      gap: 0;
    }

    & [data-mf-status-bar-button] svg {
      width: 14px;
      height: 14px;
    }
  }
`

export const LeftContainer = styled.div`
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-start;
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 22px;
  font-size: inherit;
  line-height: inherit;

  @media (max-width: 719px) {
    height: 24px;
  }

  @media (max-width: 299px) {
    gap: 2px;
  }

  @media (max-width: 229px) {
    gap: 1px;
    height: 24px;
  }
`

export const RightContainer = styled.div`
  display: flex;
  flex: 1 1 auto;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 22px;
  font-size: inherit;
  line-height: inherit;

  @media (max-width: 719px) {
    height: 24px;
  }

  @media (max-width: 399px) {
    > [role='status'] {
      min-width: 18px;
      max-width: 18px;
    }

    > [role='status'] > span {
      display: none;
    }
  }

  @media (max-width: 299px) {
    gap: 2px;
  }

  @media (max-width: 229px) {
    gap: 1px;
    height: 24px;

    > [role='status'] {
      min-width: 14px;
      max-width: 14px;
    }
  }
`

export const StatusBarSeparator = styled.span.attrs({ 'aria-hidden': true })`
  display: block;
  flex: 0 0 auto;
  width: 1px;
  height: 16px;
  margin: 0;
  background: var(--mf-ui-border-muted);

  @media (max-width: 299px) {
    height: 14px;
  }

  @media (max-width: 229px) {
    display: none;
  }
`
