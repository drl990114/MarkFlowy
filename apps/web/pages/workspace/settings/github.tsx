import { useRouter } from 'next/router'
import { useEffect } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'

export default function LegacyGitHubSettingsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/settings#github')
  }, [router])

  return (
    <LoadingContainer>
      <LoadingSpinner />
    </LoadingContainer>
  )
}

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${(props) => props.theme.bgColor};
`

const LoadingSpinner = styled.div`
  width: ${rem(40)};
  height: ${rem(40)};
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: ${(props) => props.theme.accentColor};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`
