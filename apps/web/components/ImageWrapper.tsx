import styled from 'styled-components'

const ImageWrapperContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 12px;
  border: 8px solid #1e2025;
  outline: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`
export const ImageWrapper = ({children}: {children: React.ReactNode}) => {
  return (
    <ImageWrapperContainer>
      {children}
    </ImageWrapperContainer>
  )
}
