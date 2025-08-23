import styled, { keyframes } from 'styled-components'

const rotate360 = keyframes`
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
`

const StyledLoading = styled.div`
  display: inline-block;
  animation: ${rotate360} 2s linear infinite;
  padding: 2rem 1rem;
  font-size: 1.2rem;
`

const Loading = () => (
  <div style={{ position: 'absolute', left: '50%', transform: 'translate(50%,0)' }}>
    <StyledLoading>&lt; 💅🏾 &gt;</StyledLoading>
  </div>
)

export default Loading
