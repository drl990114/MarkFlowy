import styled from 'styled-components'

export const ListContainer = styled.div`
  width: 200px;
  padding: 6px 0;

  .list {
    width: 100%;
    padding: 0;
    font-size: 14px;
    box-sizing: border-box;

    &-title {
      padding: 0 6px;
      margin: 0;
    }

    &-item {
      margin: 4px 0;
      padding: 0 6px;
      width: 100%;
      cursor: pointer;
      box-sizing: border-box;

      &__text {
        margin: 4;
        padding: 0;
        fontsize: 12px;
      }

      &__avatar {
        width: 20px;
        height: 20px;
        min-width: 20px;
        margin-right: 6px;
      }
    }
  }
`
