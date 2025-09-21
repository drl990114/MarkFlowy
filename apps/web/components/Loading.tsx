import styled from 'styled-components'

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 16px;
  color: ${(props) => props.theme.labelFontColor};
`

const Loading = () => (
  <div style={{ position: 'absolute', left: '50%', transform: 'translate(50%,0)' }}>
    <LoadingContainer>Loading ...</LoadingContainer>
  </div>
)

export default Loading
