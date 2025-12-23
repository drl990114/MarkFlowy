import styled from 'styled-components'

export const Container = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-top: 1px solid ${(props) => props.theme.borderColor};
    overflow: auto;
    line-height: 1.25rem;

    a {
      cursor: pointer;
      color: ${(props) => props.theme.accentColor};
    }

    .introduction {
      height: 100%;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;

      &-title {
        text-align: center;
      }

      &-item {
        margin: 0.875rem 0.875rem 0;
        padding: 0.875rem;
        background-color: ${(props) => props.theme.tipsBgColor};
      }
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
  padding: 8px;
  box-sizing: border-box;
  position: sticky;
  bottom: 0;
  background-color: ${(props) => props.theme.bgColor};
`
