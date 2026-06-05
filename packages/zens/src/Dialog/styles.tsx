import styled from 'styled-components'

export const DialogWrapper = styled.div.attrs<{ width?: string, padding?: string }>((props) => ({
  ...props,
  width: props.width || `min(420px, calc(100vw - 32px))`,
  padding: props.padding || `16px`,
}))`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: ${(props) => props.width};
  z-index: 99;
  margin: auto;
  display: flex;
  max-height: calc(100vh - 32px);
  flex-direction: column;
  overflow: auto;
  border-radius: 8px;
  font-size: 14px;
  background-color: ${(props) => props.theme.dialogBgColor};
  color: ${(props) => props.theme.primaryFontColor};
  padding: ${(props) => props.padding};
  box-shadow: 0 24px 60px ${(props) => props.theme.boxShadowColor};
  border: 1px solid ${(props) => props.theme.borderColor};

  .mf-dialog__heading {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.4;

    &__title {
      flex: 1;
    }
  }

  .mf-dialog__dismiss {
    display: flex;
    height: 1.5rem;
    width: 1.5rem;
    outline: none;
    user-select: none;
    align-items: center;
    justify-content: center;
    border-radius: ${(props) => props.theme.smallBorderRadius};
    border-style: none;
    background-color: transparent;
    font-size: 1rem;
    color: ${(props) => props.theme.primaryFontColor};
    font-weight: 500;

    &:hover {
      background-color: ${(props) => props.theme.hoverColor};
      color: ${(props) => props.theme.primaryFontColor};
    }

    &:focus-visible {
      box-shadow: 0 0 0 2px ${(props) => props.theme.accentColor};
    }
  }

  .mf-dialog__main {
    flex: 1;
    overflow: auto;
    color: ${(props) => props.theme.secondaryFontColor || props.theme.primaryFontColor};
    line-height: 1.55;
  }

  .mf-dialog__footer {
    display: block;
    margin-top: 16px;
  }

  .mf-confirm__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mf-confirm__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mf-confirm__remember {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: ${(props) => props.theme.labelFontColor};
    font-size: 12px;
    user-select: none;

    input {
      margin: 0;
    }
  }

  @media (max-width: 480px) {
    .mf-confirm__footer {
      align-items: stretch;
      flex-direction: column;
    }

    .mf-confirm__actions {
      justify-content: stretch;

      button {
        flex: 1;
      }
    }
  }
`

export const DialogBackdrop = styled.div`
  position: fixed;
  height: 100vh;
  width: 100vw;
  inset: 0px;
  z-index: 50;
  overflow: auto;
  background-color: ${(props) => props.theme.dialogBackdropColor};
`
