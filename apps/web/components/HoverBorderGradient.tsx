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
  display: flex;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background-color: rgba(0, 0, 0, 0.4);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  align-items: center;
  flex-direction: column;
  justify-content: center;
  overflow: visible;
  padding: 1.5px;
  width: fit-content;
  cursor: pointer;

  &:hover {
    transform: scale(1.06);
  }
`

const Content = styled.div`
  width: auto;
  color: #000000;
  z-index: 2;
  background-color: #ffffff;
  padding: ${rem(8)} ${rem(28)};
  border-radius: inherit;
  font-weight: 600;
  font-size: ${rem(16)};
  display: flex;
  align-items: center;
  gap: ${rem(10)};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
`

const MotionBackground = styled(motion.div)`
  flex: none;
  inset: -1px;
  overflow: hidden;
  position: absolute;
  z-index: 0;
  border-radius: inherit;
  filter: blur(4px);
  width: calc(100% + 2px);
  height: calc(100% + 2px);
`

const InnerBackground = styled.div`
  background-color: #ffffff;
  position: absolute;
  z-index: 1;
  inset: 2px;
  border-radius: 9999px;
`

export function HoverBorderGradient({
  children,
  as: Tag = 'button',
  duration = 1.2,
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
    TOP: 'radial-gradient(30% 60% at 50% 0%, #ff8c00 0%, #ff8c00 40%, rgba(255, 140, 0, 0) 100%)',
    LEFT: 'radial-gradient(25% 55% at 0% 50%, #ff8c00 0%, #ff8c00 40%, rgba(255, 140, 0, 0) 100%)',
    BOTTOM: 'radial-gradient(30% 60% at 50% 100%, #ff8c00 0%, #ff8c00 40%, rgba(255, 140, 0, 0) 100%)',
    RIGHT: 'radial-gradient(25% 55% at 100% 50%, #ff8c00 0%, #ff8c00 40%, rgba(255, 140, 0, 0) 100%)',
  }

  const highlight = 'radial-gradient(80% 180% at 50% 50%, #ff8c00 0%, #ff8c00 30%, rgba(255, 255, 255, 0) 100%)'

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
