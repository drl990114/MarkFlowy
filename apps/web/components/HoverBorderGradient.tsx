'use client'
import { motion, useReducedMotion } from 'motion/react'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'

type Direction = 'TOP' | 'LEFT' | 'BOTTOM' | 'RIGHT'
const DIRECTIONS: Direction[] = ['TOP', 'LEFT', 'BOTTOM', 'RIGHT']

const rotateDirection = (currentDirection: Direction, clockwise: boolean): Direction => {
  const currentIndex = DIRECTIONS.indexOf(currentDirection)
  const nextIndex = clockwise
    ? (currentIndex - 1 + DIRECTIONS.length) % DIRECTIONS.length
    : (currentIndex + 1) % DIRECTIONS.length
  return DIRECTIONS[nextIndex]
}

type HoverBorderGradientProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  duration?: number
  clockwise?: boolean
}

const Container = styled.button`
  position: relative;
  display: inline-flex;
  border-radius: 9999px;
  border: 0;
  background-color: var(--ink);
  color: inherit;
  font: inherit;
  transition:
    transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.4s cubic-bezier(0.22, 0.61, 0.36, 1);
  align-items: center;
  justify-content: center;
  min-height: 44px;
  overflow: visible;
  padding: 1.5px;
  width: fit-content;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--seal);
    outline-offset: 3px;
  }

  &:active {
    transform: translateY(-1px);
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      transform: translateY(-2px);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        0 2px 8px rgba(212, 86, 74, 0.15);
    }
  }

  @media (max-width: 26.25em) {
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Content = styled.div`
  width: auto;
  color: var(--paper);
  z-index: 2;
  background-color: var(--ink);
  padding: ${rem(11)} ${rem(28)};
  border-radius: inherit;
  font-family: var(--sans);
  font-weight: 600;
  font-size: ${rem(14)};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${rem(8)};
  letter-spacing: 0.01em;
  pointer-events: none;

  @media (max-width: 26.25em) {
    width: 100%;
  }
`

const MotionBackground = styled(motion.div)`
  position: absolute;
  inset: -1px;
  overflow: hidden;
  z-index: 0;
  border-radius: inherit;
  filter: blur(0px);
  width: calc(100% + 2px);
  height: calc(100% + 2px);
`

const InnerBackground = styled.div`
  background-color: var(--ink);
  position: absolute;
  z-index: 1;
  inset: 1.5px;
  border-radius: 9999px;
`

export function HoverBorderGradient({
  children,
  duration = 1.5,
  clockwise = true,
  ...props
}: HoverBorderGradientProps) {
  const shouldReduceMotion = useReducedMotion()
  const [hovered, setHovered] = useState<boolean>(false)
  const [direction, setDirection] = useState<Direction>('TOP')

  const movingMap: Record<Direction, string> = {
    TOP: 'radial-gradient(30% 60% at 50% 0%, #d4564a 0%, #d4564a 35%, rgba(212, 86, 74, 0) 100%)',
    LEFT: 'radial-gradient(25% 55% at 0% 50%, #d4564a 0%, #d4564a 35%, rgba(212, 86, 74, 0) 100%)',
    BOTTOM:
      'radial-gradient(30% 60% at 50% 100%, #d4564a 0%, #d4564a 35%, rgba(212, 86, 74, 0) 100%)',
    RIGHT:
      'radial-gradient(25% 55% at 100% 50%, #d4564a 0%, #d4564a 35%, rgba(212, 86, 74, 0) 100%)',
  }

  const highlight =
    'radial-gradient(80% 180% at 50% 50%, #e06b5f 0%, #d4564a 30%, rgba(212, 86, 74, 0) 100%)'

  useEffect(() => {
    if (!hovered && !shouldReduceMotion) {
      const interval = setInterval(() => {
        if (!document.hidden) {
          setDirection((prevState) => rotateDirection(prevState, clockwise))
        }
      }, duration * 1000)
      return () => clearInterval(interval)
    }
  }, [clockwise, duration, hovered, shouldReduceMotion])

  return (
    <Container
      type='button'
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      <Content>{children}</Content>
      <MotionBackground
        initial={false}
        animate={{
          background:
            hovered && !shouldReduceMotion
              ? [movingMap[direction], highlight]
              : movingMap[direction],
        }}
        transition={{ ease: 'linear', duration: shouldReduceMotion ? 0 : duration }}
      />
      <InnerBackground />
    </Container>
  )
}
