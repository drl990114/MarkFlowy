'use client'
import { motion } from 'motion/react'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'

type Direction = 'TOP' | 'LEFT' | 'BOTTOM' | 'RIGHT'

type HoverBorderGradientProps = {
  as?: React.ElementType
  duration?: number
  clockwise?: boolean
  children: React.ReactNode
  onClick?: () => void
}

const Container = styled.div`
  position: relative;
  display: inline-flex;
  border-radius: 9999px;
  background-color: var(--ink);
  transition: transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow 0.4s cubic-bezier(0.22, 0.61, 0.36, 1);
  align-items: center;
  justify-content: center;
  overflow: visible;
  padding: 1.5px;
  width: fit-content;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(212, 86, 74, 0.15);
  }

  &:active {
    transform: translateY(-1px);
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
  gap: ${rem(8)};
  letter-spacing: 0.01em;
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
  as: Tag = 'button',
  duration = 1.5,
  clockwise = true,
  onClick,
  ...props
}: HoverBorderGradientProps) {
  const [hovered, setHovered] = useState<boolean>(false)
  const [direction, setDirection] = useState<Direction>('TOP')

  const rotateDirection = (currentDirection: Direction): Direction => {
    const directions: Direction[] = ['TOP', 'LEFT', 'BOTTOM', 'RIGHT']
    const currentIndex = directions.indexOf(currentDirection)
    const nextIndex = clockwise
      ? (currentIndex - 1 + directions.length) % directions.length
      : (currentIndex + 1) % directions.length
    return directions[nextIndex]
  }

  const movingMap: Record<Direction, string> = {
    TOP: 'radial-gradient(30% 60% at 50% 0%, #d4564a 0%, #d4564a 35%, rgba(212, 86, 74, 0) 100%)',
    LEFT: 'radial-gradient(25% 55% at 0% 50%, #d4564a 0%, #d4564a 35%, rgba(212, 86, 74, 0) 100%)',
    BOTTOM: 'radial-gradient(30% 60% at 50% 100%, #d4564a 0%, #d4564a 35%, rgba(212, 86, 74, 0) 100%)',
    RIGHT: 'radial-gradient(25% 55% at 100% 50%, #d4564a 0%, #d4564a 35%, rgba(212, 86, 74, 0) 100%)',
  }

  const highlight = 'radial-gradient(80% 180% at 50% 50%, #e06b5f 0%, #d4564a 30%, rgba(212, 86, 74, 0) 100%)'

  useEffect(() => {
    if (!hovered) {
      const interval = setInterval(() => {
        setDirection((prevState) => rotateDirection(prevState))
      }, duration * 1000)
      return () => clearInterval(interval)
    }
  }, [hovered, duration])

  return (
    <Container
      as={Tag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      {...props}
    >
      <Content>{children}</Content>
      <MotionBackground
        initial={{ background: movingMap[direction] }}
        animate={{
          background: hovered ? [movingMap[direction], highlight] : movingMap[direction],
        }}
        transition={{ ease: 'linear', duration: duration ?? 1 }}
      />
      <InnerBackground />
    </Container>
  )
}
