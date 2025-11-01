import styled from 'styled-components'

const Container = styled.div`
  position: relative;
  z-index: 40;
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
`

const PlatformLink = styled.a`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  font-size: 20px;

  &:hover {
    transform: translateY(-2px);
  }
`

export function SupportPlatforms() {
  return (
    <Container>
      <PlatformLink
        href='https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA'
        aria-label='Download for macOS'
        target='_blank'
      >
        <i className='ri-apple-fill'></i>
      </PlatformLink>

      <PlatformLink
        href='https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA'
        aria-label='Download for Windows'
        target='_blank'
      >
        <i className='ri-windows-fill'></i>
      </PlatformLink>

      <PlatformLink
        href='https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA'
        aria-label='Download for Linux'
        target='_blank'
      >
        <i className='ri-ubuntu-fill'></i>
      </PlatformLink>
    </Container>
  )
}
