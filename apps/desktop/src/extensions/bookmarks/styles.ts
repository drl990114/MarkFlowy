import styled from 'styled-components'

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  letter-spacing: var(--mf-ui-tracking-control);

  .bookmark-list {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    padding: 0;
    overflow: hidden;
    box-sizing: border-box;

    &__toolbar {
      display: flex;
      flex: 0 0 24px;
      align-items: center;
      justify-content: flex-end;
      min-height: 24px;
      padding: 1px 4px;
      box-sizing: border-box;
    }

    &__content {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
      gap: 0;
      padding: 4px 0;
      overflow: auto;
    }

    &__item {
      display: flex;
      flex: 0 0 auto;
      flex-direction: column;
      gap: 3px;
      align-items: flex-start;
      position: relative;
      width: 100%;
      min-height: 24px;
      padding: 3px 6px;
      cursor: pointer;
      border: 0;
      border-radius: 0;
      color: var(--mf-text-primary, ${(props) => props.theme.primaryFontColor});
      background: transparent;
      font: inherit;
      text-align: left;
      user-select: none;
      box-sizing: border-box;
      transition: background-color var(--mf-motion-duration-fast, 120ms)
        var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1));

      &:hover {
        background-color: var(--mf-control-ghost-hover, ${(props) => props.theme.hoverColor});
      }

      &:active {
        background-color: var(--mf-control-ghost-pressed, ${(props) =>
          props.theme.fileTreeSelectedBgColor});
      }

      &:focus-visible {
        outline: 2px solid var(--mf-control-focus, ${(props) => props.theme.accentColor});
        outline-offset: -2px;
      }
    }

    &__title {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__tags {
      display: flex;
      max-width: 100%;
      gap: 4px;
      overflow: hidden;
    }

    &__error {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 36px;
      padding: 4px 6px 4px 8px;
      border: 1px solid var(--mf-destructive, ${(props) => props.theme.dangerColor});
      border-radius: 4px;
      color: var(--mf-destructive, ${(props) => props.theme.dangerColor});
      background: color-mix(
        in srgb,
        var(--mf-destructive, ${(props) => props.theme.dangerColor}) 9%,
        transparent
      );
      font-size: var(--mf-ui-font-caption);
      line-height: var(--mf-ui-line-height-caption);
    }

    .bookmark-tagsview__header {
      flex-direction: row;
      align-items: center;
      gap: 2px;
    }
  }
`

export const ListContainer = styled.div`
  .item {
    padding: 8px;
    box-sizing: border-box;

    &-header {
      display: flex;
      justify-content: space-between;
    }

    &-title {
      display: flex;
      align-items: center;
    }

    &-icon {
      margin-right: 2px;
      font-size: 18px;
    }
  }

  .question {
    height: 100%;
    width: 100%;
    background: ${(props) => props.theme.bgColor};
  }

  .answer {
    height: 100%;
    width: 100%;
    background: ${(props) => props.theme.tipsBgColor};
  }
`

export const BottomBar = styled.div`
  display: flex;
  width: 100%;
  height: 46px;
  padding: 8px;
  box-sizing: border-box;
  position: sticky;
  bottom: 0;
  background-color: ${(props) => props.theme.bgColor};

  .input {
    margin: 0 8px;
    flex: 1 1 70px;
    border: 1px solid ${(props) => props.theme.borderColor};
    min-width: 50px;
  }

  .submit {
    font-size: 0.7rem;
  }
`
