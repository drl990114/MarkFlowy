import { useInView, useReducedMotion } from 'motion/react'
import { useTranslation } from 'next-i18next'
import React, { useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { mobile, phone } from '../utils/media'
import rem from '../utils/rem'

export type GlobeContributor = {
  id: number
  login: string
  avatar_url: string
  html_url: string
}

type ContributorGlobeProps = {
  contributors: GlobeContributor[]
}

type OrbitStyle = React.CSSProperties & {
  '--angle': string
}

const ORBIT_LIMIT = 16

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`

const spinReverse = keyframes`
  to {
    transform: rotate(-360deg);
  }
`

const travel = keyframes`
  to {
    transform: translate3d(-50%, 0, 0);
  }
`

function WorldTexture({ idPrefix }: { idPrefix: string }) {
  const patternId = `${idPrefix}-land-dots`

  return (
    <TextureSvg viewBox='0 0 360 360' preserveAspectRatio='none' aria-hidden='true'>
      <defs>
        <pattern id={patternId} width='11' height='11' patternUnits='userSpaceOnUse'>
          <circle cx='3' cy='3' r='2.2' fill='currentColor' />
        </pattern>
      </defs>
      <g fill={`url(#${patternId})`}>
        <path d='M18 79 45 56l38-4 25 19 4 27-21 19-8 29-25 4-15-20-25-8-8-24Z' />
        <path d='m84 156 28 8 18 25-5 31-16 26-7 38-18 19-13-27 6-34-13-29 5-35Z' />
        <path d='m154 83 19-13 24 5 8 14-16 11-18-5-15 12-10-10Z' />
        <path d='m178 110 30-10 29 9 20 20-5 25-21 14-9 35-22 23-17-18-3-30-18-17 4-28Z' />
        <path d='m220 78 32-22 48 2 31 20 18 34-20 18-36-9-25 14-20-19-33-7-9-18Z' />
        <path d='m287 223 27-11 27 13 9 22-18 15-31-2-19-17Z' />
        <path d='m332 158 22-8 17 12-5 17-23 3-16-11Z' />
      </g>
    </TextureSvg>
  )
}

function OrbitContributor({
  contributor,
  index,
  count,
  isAnimating,
}: {
  contributor: GlobeContributor
  index: number
  count: number
  isAnimating: boolean
}) {
  const [hasImageError, setHasImageError] = useState(false)
  const angle = `${(360 / count) * index}deg`
  const avatarUrl = `${contributor.avatar_url}${contributor.avatar_url.includes('?') ? '&' : '?'}s=96`

  return (
    <OrbitSlot style={{ '--angle': angle } as OrbitStyle}>
      <OrbitLink
        href={contributor.html_url}
        target='_blank'
        rel='noopener noreferrer'
        aria-label={`${contributor.login} · GitHub`}
        title={contributor.login}
      >
        {hasImageError ? (
          <AvatarFallback $isAnimating={isAnimating}>
            {contributor.login.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        ) : (
          <OrbitImage
            $isAnimating={isAnimating}
            src={avatarUrl}
            alt=''
            width={48}
            height={48}
            loading='lazy'
            decoding='async'
            referrerPolicy='no-referrer'
            onError={() => setHasImageError(true)}
          />
        )}
      </OrbitLink>
    </OrbitSlot>
  )
}

export default function ContributorGlobe({ contributors }: ContributorGlobeProps) {
  const { t } = useTranslation()
  const sceneRef = useRef<HTMLDivElement>(null)
  const isNearViewport = useInView(sceneRef, { amount: 0.05, margin: '180px 0px' })
  const shouldReduceMotion = useReducedMotion()
  const visibleContributors = contributors.slice(0, ORBIT_LIMIT)
  const isAnimating = isNearViewport && !shouldReduceMotion

  return (
    <Scene ref={sceneRef} role='group' aria-label={t('home.contributors.globeLabel')}>
      <AmbientGlow aria-hidden='true' />

      <Globe aria-hidden='true'>
        <TextureTrack $isAnimating={isAnimating}>
          <WorldTexture idPrefix='markflowy-world-a' />
          <WorldTexture idPrefix='markflowy-world-b' />
        </TextureTrack>

        <GridSvg viewBox='0 0 400 400' aria-hidden='true'>
          <circle cx='200' cy='200' r='194' />
          <ellipse cx='200' cy='200' rx='194' ry='66' />
          <ellipse cx='200' cy='200' rx='194' ry='125' />
          <ellipse cx='200' cy='200' rx='72' ry='194' />
          <ellipse cx='200' cy='200' rx='132' ry='194' />
          <path d='M8 200h384' />
        </GridSvg>

        <GlobeShade />
      </Globe>

      <Orbit role='group' aria-label={t('home.contributors.orbitLabel')}>
        <OrbitRing $isAnimating={isAnimating}>
          {visibleContributors.map((contributor, index) => (
            <OrbitContributor
              key={contributor.id}
              contributor={contributor}
              index={index}
              count={visibleContributors.length}
              isAnimating={isAnimating}
            />
          ))}
        </OrbitRing>
      </Orbit>
    </Scene>
  )
}

const Scene = styled.div`
  position: relative;
  width: min(100%, ${rem(620)});
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  isolation: isolate;
  margin: 0 auto;

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-play-state: paused !important;
    }
  }

  ${mobile(css`
    width: min(100%, ${rem(520)});
  `)}

  ${phone(css`
    width: min(100%, ${rem(360)});
  `)}
`

const AmbientGlow = styled.div`
  position: absolute;
  inset: 18%;
  border-radius: 50%;
  background: color-mix(in srgb, var(--seal) 24%, transparent);
  filter: blur(${rem(70)});
  opacity: 0.42;
  transform: translate3d(-6%, 2%, 0);
  z-index: -1;

  ${phone(css`
    filter: blur(${rem(42)});
  `)}
`

const Globe = styled.div`
  position: relative;
  width: 72%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--seal) 38%, var(--line-soft));
  border-radius: 50%;
  background: radial-gradient(circle at 36% 30%, rgba(232, 230, 227, 0.11), transparent 34%),
    radial-gradient(circle at 50% 55%, var(--paper-warm), var(--paper-deep) 72%);
  box-shadow:
    inset ${rem(-34)} ${rem(-22)} ${rem(68)} rgba(0, 0, 0, 0.58),
    inset ${rem(18)} ${rem(12)} ${rem(36)} rgba(232, 230, 227, 0.04),
    0 ${rem(32)} ${rem(80)} ${rem(-28)} var(--shadow);
  transform: translate3d(-4%, 1.5%, 0) rotate(-3deg);
  -webkit-mask-image: linear-gradient(
    to right,
    #000 0%,
    #000 58%,
    rgba(0, 0, 0, 0.86) 72%,
    rgba(0, 0, 0, 0.42) 91%,
    rgba(0, 0, 0, 0.14) 100%
  );
  mask-image: linear-gradient(
    to right,
    #000 0%,
    #000 58%,
    rgba(0, 0, 0, 0.86) 72%,
    rgba(0, 0, 0, 0.42) 91%,
    rgba(0, 0, 0, 0.14) 100%
  );
  z-index: 1;

  ${phone(css`
    transform: translate3d(-2%, 1%, 0) rotate(-2deg);
  `)}
`

const TextureTrack = styled.div<{ $isAnimating: boolean }>`
  position: absolute;
  inset: 0 auto 0 0;
  display: flex;
  width: 200%;
  color: color-mix(in srgb, var(--seal) 72%, var(--ink-soft));
  opacity: 0.7;
  will-change: transform;
  animation: ${travel} 30s linear infinite;
  animation-play-state: ${({ $isAnimating }) => ($isAnimating ? 'running' : 'paused')};
`

const TextureSvg = styled.svg`
  flex: 0 0 50%;
  width: 50%;
  height: 100%;
`

const GridSvg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: color-mix(in srgb, var(--ink-soft) 52%, transparent);
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  opacity: 0.32;
`

const GlobeShade = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 28%, rgba(255, 255, 255, 0.08), transparent 26%),
    linear-gradient(90deg, rgba(0, 0, 0, 0.32), transparent 28% 63%, rgba(0, 0, 0, 0.68));
  box-shadow: inset 0 0 ${rem(46)} rgba(0, 0, 0, 0.38);
  pointer-events: none;
`

const OrbitRing = styled.div<{ $isAnimating: boolean }>`
  position: absolute;
  inset: clamp(${rem(22)}, 5.5%, ${rem(34)});
  will-change: transform;
  animation: ${spin} 38s linear infinite;
  animation-play-state: ${({ $isAnimating }) => ($isAnimating ? 'running' : 'paused')};
`

const OrbitSlot = styled.div`
  position: absolute;
  inset: 0;
  transform: rotate(var(--angle));
`

const OrbitLink = styled.a`
  position: absolute;
  top: 0;
  left: 50%;
  display: grid;
  width: clamp(44px, 5vw, ${rem(48)});
  height: clamp(44px, 5vw, ${rem(48)});
  place-items: center;
  overflow: hidden;
  border: 2px solid var(--paper);
  border-radius: 50%;
  background: var(--paper-warm);
  box-shadow:
    0 ${rem(10)} ${rem(24)} ${rem(-8)} rgba(0, 0, 0, 0.62),
    inset 0 0 0 1px var(--line-faint);
  transform: translate(-50%, -50%) rotate(calc(-1 * var(--angle))) scale(1);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
  pointer-events: auto;

  &:focus-visible {
    border-color: var(--seal);
    outline: 2px solid var(--seal);
    outline-offset: 3px;
  }

  &:active {
    transform: translate(-50%, -50%) rotate(calc(-1 * var(--angle))) scale(0.97);
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      border-color: var(--seal);
      box-shadow:
        0 ${rem(12)} ${rem(30)} ${rem(-8)} rgba(0, 0, 0, 0.72),
        inset 0 0 0 1px var(--seal);
      transform: translate(-50%, -50%) rotate(calc(-1 * var(--angle))) scale(1.08);
    }
  }

  ${phone(css`
    width: 44px;
    height: 44px;
  `)}
`

const OrbitImage = styled.img<{ $isAnimating: boolean }>`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: ${spinReverse} 38s linear infinite;
  animation-play-state: ${({ $isAnimating }) => ($isAnimating ? 'running' : 'paused')};
`

const AvatarFallback = styled.span<{ $isAnimating: boolean }>`
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--ink-soft);
  font-family: var(--sans);
  font-size: ${rem(15)};
  font-weight: 800;
  animation: ${spinReverse} 38s linear infinite;
  animation-play-state: ${({ $isAnimating }) => ($isAnimating ? 'running' : 'paused')};
`

const Orbit = styled.div`
  position: absolute;
  top: 49%;
  left: 48%;
  width: 108%;
  aspect-ratio: 1;
  transform: translate3d(-50%, -50%, 0) rotate(-4deg);
  z-index: 2;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(
    to right,
    #000 0%,
    #000 22%,
    rgba(0, 0, 0, 0.55) 52%,
    rgba(0, 0, 0, 0.18) 78%,
    transparent 92%
  );
  mask-image: linear-gradient(
    to right,
    #000 0%,
    #000 22%,
    rgba(0, 0, 0, 0.55) 52%,
    rgba(0, 0, 0, 0.18) 78%,
    transparent 92%
  );

  ${phone(css`
    top: 50%;
    left: 49%;
    width: 106%;
    transform: translate3d(-50%, -50%, 0) rotate(-3deg);
  `)}

  &:hover
    ${OrbitRing},
    &:focus-within
    ${OrbitRing},
    &:hover
    ${OrbitImage},
    &:focus-within
    ${OrbitImage},
    &:hover
    ${AvatarFallback},
    &:focus-within
    ${AvatarFallback} {
    animation-play-state: paused;
  }
`
