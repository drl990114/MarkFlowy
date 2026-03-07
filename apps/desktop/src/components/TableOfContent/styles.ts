import { darken, ScThemeProps } from '@markflowy/theme'
import styled, { css } from 'styled-components'
import type { ITocListProps } from './type'

const scrollbarHidden = css`
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 6px;
    background: transparent;
  }

  scrollbar-width: none;
  -ms-overflow-style: none;
  overflow: -moz-scrollbars-none;
  overflow: hidden;
`

const scrollbarVisible = (props: ScThemeProps) => css`
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
    display: block;
  }

  &::-webkit-scrollbar-thumb {
    background: ${(props.theme as any).scrollbarThumbColor};
  }

  scrollbar-width: thin;
  -ms-overflow-style: auto;
  overflow: auto;
`

const tocListExpandedAlign = css`
  ul {
    align-items: stretch;
  }

  li {
    justify-content: flex-start;
  }

  .toc-list a {
    justify-content: flex-start;
  }
`

type TocDivProps = ScThemeProps & {
  variant?: 'sidebar' | 'editor'
  compact?: boolean
  toolbarFixed?: boolean
  hasToolbar?: boolean
}

export const TocDiv = styled.div<TocDivProps>`
  position: relative;
  height: 100%;
  width: 100%;
  line-height: 1.6em;
  padding-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8rem;
  box-sizing: border-box;

  .toc-list {
    height: 100%;
    padding: 0.4rem 1rem;
    overflow: hidden;
    box-sizing: border-box;
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 4px;
    ${scrollbarHidden};

    &:hover::-webkit-scrollbar-thumb {
      background: ${(props) => props.theme.scrollbarThumbColor};
    }
  }

  .toc-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-height: 32px;
    padding: 0.25rem 0.5rem;
    border-radius: 8px;
    background: ${(props) => props.theme.rightBarHeaderBgColor};
    border: 1px solid ${(props) => props.theme.borderColor};
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
    z-index: 2;
    ${(props) =>
      props.toolbarFixed &&
      css`
        position: sticky;
        top: 0;
      `}

    ${(props) =>
      !props.compact &&
      css`
        background-color: transparent;
        border: none;
        opacity: 1;
      `}
  }

  .toc-toolbar__title {
    font-weight: 600;
    font-size: 0.9rem;
    color: ${(props) => props.theme.primaryFontColor};
  }

  .toc-toolbar__pin {
    display: none;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: ${(props) => props.theme.labelFontColor};
    cursor: pointer;
    transition:
      color 0.2s ease,
      background 0.2s ease,
      transform 0.2s ease;

    &:hover {
      color: ${(props) => props.theme.primaryFontColor};
      background: ${(props) => props.theme.hoverColor};
      transform: translateY(-1px);
    }

    &.is-active {
      color: ${(props) => props.theme.accentColor};
      background: ${(props) => props.theme.accentColorFocused};
    }
  }

  nav {
    flex: 1 1 auto;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: normal;
    ${scrollbarHidden};

    &:hover,
    &.show-scrollbar,
    .toc-list--expanded & {
      ${scrollbarVisible};
    }
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  li {
    width: 100%;
    display: flex;
    justify-content: center;
    box-sizing: border-box;
  }

  ${(props) =>
    props.variant === 'editor' &&
    css`
      font-size: 0.72rem;
      line-height: 1.35em;

      .toc-list {
        padding: 0.25rem 0.5rem;
      }

      ul {
        gap: 2px;
        align-items: flex-end;
      }

      li {
        justify-content: flex-end;
      }

      a {
        gap: 6px;
        min-height: 12px;
      }
    `}

  ${(props) =>
    props.compact &&
    css`
      .toc-list a::before {
        height: 3px;
      }
    `}

  &:hover {
    .toc-toolbar__pin {
      display: inline-flex;
    }

    .toc-toolbar {
      opacity: 1;
      pointer-events: auto;
    }
  }

  ${(props) =>
    props.compact === false &&
    css`
      .toc-list {
        overflow: auto;
      }

      nav {
        ${scrollbarVisible(props)};

        &:hover {
          ${scrollbarVisible(props)};
        }
      }

      ${tocListExpandedAlign};

      .toc-link__chapter {
        white-space: nowrap;
        word-break: nowrap;
      }
    `}

  ${(props) =>
    props.compact !== false &&
    css`
      &:hover,
      .toc-list--expanded {
        .toc-list {
          overflow: auto;
        }

        nav {
          ${scrollbarVisible(props)};
        }

        ${tocListExpandedAlign};

        .toc-link__chapter,
        .toc-link__title {
          opacity: 1;
          transform: translateX(0);
          max-width: 160px;
        }

        .toc-link__title {
          margin-left: 0;
        }

        .toc-list a::before {
          width: 0;
          opacity: 0;
        }
      }

      nav:hover {
        ${scrollbarVisible(props)};
      }
    `}
`
export const TocLink = styled.a<ITocListProps & ScThemeProps>`
  color: ${(props) => (props.active ? props.theme.primaryFontColor : props.theme.labelFontColor)};
  font-weight: ${(props) => (props.active ? `600` : '400')};
  display: inline-flex;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  box-shadow: none;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-height: 14px;
  width: 100%;

  ${(props) =>
    props.compact &&
    css`
      &::before {
        position: absolute;
        right: 0;
        content: '';
        width: ${props.tocBarWidth || 18}px;
        height: 4px;
        border-radius: 999px;
        background: ${props.active
          ? props.theme.tocbarProgressActiveBgColor
          : props.theme.tocbarProgressBgColor};
        transition:
          width 0.2s ease,
          background 0.2s ease,
          opacity 0.2s ease;
        max-width: 80px;
        flex: 0 0 auto;
      }
    `}

  & .toc-link__chapter {
    margin-right: ${(props) => props.theme.spaceXs};
    text-align: right;
    color: ${(props) =>
      props.active ? props.theme.accentColor : darken(props.theme.accentColor!, 0.2)};
    font-weight: bold;
  }

  & .toc-link__chapter,
  & .toc-link__title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
    pointer-events: auto;
    white-space: nowrap;
    word-break: nowrap;
    transition:
      opacity 0.2s ease,
      transform 0.2s ease,
      max-width 0.2s ease;

    ${(props) =>
      props.compact !== false
        ? css`
            opacity: 0;
            transform: translateX(-6px);
            max-width: 0;
            pointer-events: none;
          `
        : css`
            opacity: 1;
            transform: translateX(0);
            pointer-events: auto;
          `}
  }
`

type ContainerProps = {
  variant?: 'sidebar' | 'editor'
}

export const TocViewContainer = styled.div<ContainerProps>`
  flex-grow: 0;
  flex-shrink: 0;
  height: 100%;
  width: 100%;
  position: relative;
  background: ${(props) => props.theme.rightBarBgColor};
  color: ${(props) => props.theme.primaryFontColor};
  overflow: hidden;

  ${(props) =>
    props.variant === 'editor' &&
    css`
      background: transparent;
      width: 280px;
      height: 100%;
      overflow: visible;

      &:hover {
        height: 100%;
        max-height: 100%;
      }
    `}

  .app-sidebar {
    &__item {
      width: 20px;
      height: 20px;
      cursor: pointer;
      font-size: 16px;
    }

    &-active {
      color: ${(props) => props.theme.accentColor};
    }

    &-content {
      overflow: hidden;
    }

    &-resizer {
      position: absolute;
      height: 100%;
      width: 1px;
      right: 1px;
      cursor: col-resize;
      resize: horizontal;
      background: transparent;
    }

    &-resizer:hover {
      width: 3px;
      background: ${(props) => props.theme.labelFontColor};
    }
  }
`

const listItemShiftWidthEm = 1

export const TocListItem = styled.li<ITocListProps>`
  margin: 0;
  list-style: none;
  position: relative;
  display: flex;
  align-items: center;
  padding-left: ${(props) => `${props.depth * listItemShiftWidthEm}em`};
`
