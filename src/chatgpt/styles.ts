import customColors from '@/colors'
import styled from 'styled-components'

export const Container = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-size: 0.8rem;
  line-height: 1.25rem;

  .content {
    height: calc(100% - 60px);
    overflow: auto;
  }
`

export const ListContainer = styled.div`
  .item {
    padding: 8px;
  }

  .question {
    background: ${customColors.bgColor}
  }

  .answer {
    background: ${customColors.tipsBgColor}
  }
`

export const BottomBar = styled.div`
  display: flex;
  width: 100%;
  height: 46px;
  padding: 8px;
  position: sticky;
  bottom: 0;
  background-color: ${customColors.bgColor};

  .input {
    margin: 0 8px;
    flex: 1 1 70px;
    border: 1px solid ${customColors.borderColor};
    min-width: 50px;
  }

  .submit {
    font-size: 0.7rem;
  }
`
