import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import styled from 'styled-components'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!router.isReady) return

    const { access_token, refresh_token } = router.query

    if (typeof access_token === 'string' && typeof refresh_token === 'string') {
      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      router.replace('/workspace/github')
    } else {
      setError('Authentication failed. Missing tokens.')
    }
  }, [router])

  if (error) {
    return (
      <Container>
        <ErrorMessage>{error}</ErrorMessage>
      </Container>
    )
  }

  return (
    <Container>
      <LoadingText>Signing in...</LoadingText>
    </Container>
  )
}

const Container = styled.div`
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.theme.primaryFontColor};
`

const LoadingText = styled.div`
  font-size: 16px;
`

const ErrorMessage = styled.div`
  font-size: 16px;
  color: #dc2626;
`
