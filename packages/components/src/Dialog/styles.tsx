import styled from 'styled-components'

export const DialogWrapper = styled.div.attrs<{ width?: string }>((props) => ({
  ...props,
  width: props.width || `420px`,
}))`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: ${(props) => props.width};
  z-index: 99;
  margin: auto;
  display: flex;
  max-height: calc(100vh - 2 * 0.75rem);
  flex-direction: column;
  overflow: auto;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: 14px;
  background-color: ${(props) => props.theme.dialogBgColor};
  color: ${(props) => props.theme.primaryFontColor};
  padding: 1rem;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);

  .mf-dialog__heading {
    display: flex;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    font-weight: 600;

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
    border-radius: 0.2rem;
    border-style: none;
    background-color: transparent;
    font-size: 1rem;
    color: ${(props) => props.theme.primaryFontColor};
    font-weight: 500;

    &:hover {
      background-color: ${(props) => props.theme.accentColor};
      color: ${(props) => props.theme.white};
    }
  }

  .mf-dialog__main {
    flex: 1;
    overflow: auto;
  }

  .mf-dialog__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
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
