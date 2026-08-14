import styled from 'styled-components'

export const Container = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  letter-spacing: var(--mf-ui-tracking-control);

  .bookmark-list {
    height: calc(100% - 32px);
    padding: 0.2rem 0.4rem;
    overflow: auto;
    box-sizing: border-box;

    &__item {
      position: relative;
      padding: 0.3rem 0.6rem;
      cursor: pointer;
      border-radius: 4px;
      user-select: none;
      transition: background-color 100ms ease;

      &:hover {
        background-color: ${(props) => props.theme.tipsBgColor};
      }
    }

    &__tag {
      padding: 2px 4px;
      margin-right: 4px;
      border-radius: 4px;
      font-size: var(--mf-ui-font-caption);
      line-height: var(--mf-ui-line-height-caption);
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
