import styled from 'styled-components'
import rem from 'utils/rem'

const Container = styled.div`
  position: relative;
  z-index: 40;
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${rem(20)};
`

const PlatformLink = styled.a`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${rem(48)};
  height: ${rem(48)};
  border-radius: ${rem(12)};
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  font-size: ${rem(24)};
  color: rgba(255, 255, 255, 0.8);

  &:hover {
    transform: translateY(-4px);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    color: #ffffff;
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
