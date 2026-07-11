import type { ComponentProps, CSSProperties } from 'react'
import { cn } from '../lib/cn'

const GRID_SIZE = 5
const DOT_INDEXES = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index)

function hash(index: number, salt: number, range: number) {
  let value = (Math.imul(index, 374761393) + Math.imul(salt, 668265263)) >>> 0
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0
  return ((value ^ (value >>> 16)) % range) / 1_000
}

export type DotMatrixState = 'loading' | 'thinking' | 'streaming'

function getBlink(state: DotMatrixState, index: number, row: number, column: number) {
  if (state === 'thinking') {
    return { duration: 1.2, delay: -(row + column) * 0.09, lowOpacity: 0.2 }
  }
  if (state === 'streaming') {
    return {
      duration: 0.9,
      delay: -(row * 0.12 + hash(column, 3, 900)),
      lowOpacity: 0.15,
    }
  }
  return {
    duration: 0.9 + hash(index, 2, 700),
    delay: -hash(index, 1, 1_200),
    lowOpacity: 0.15,
  }
}

export type DotMatrixProps = Omit<ComponentProps<'span'>, 'children'> & {
  state?: DotMatrixState
  label: string
}

/** Adapted from assistant-ui's standalone Dot Matrix registry component. */
export function DotMatrix({ className, state = 'loading', label, ...props }: DotMatrixProps) {
  return (
    <span
      className={cn('inline-block size-4 shrink-0', className)}
      data-slot='dot-matrix'
      data-state={state}
      role='status'
      {...props}
    >
      <span className='sr-only'>{label}</span>
      <svg aria-hidden='true' className='size-full' fill='currentColor' viewBox='0 0 20 20'>
        {DOT_INDEXES.map((index) => {
          const row = Math.floor(index / GRID_SIZE)
          const column = index % GRID_SIZE
          const blink = getBlink(state, index, row, column)
          return (
            <circle
              key={index}
              className='aui-dot-matrix-dot'
              cx={2 + column * 4}
              cy={2 + row * 4}
              data-slot='dot-matrix-dot'
              r={1.3}
              style={
                {
                  animationDelay: `${blink.delay}s`,
                  animationDuration: `${blink.duration}s`,
                  '--aui-dot-matrix-hi': 1,
                  '--aui-dot-matrix-lo': blink.lowOpacity,
                } as CSSProperties
              }
            />
          )
        })}
      </svg>
    </span>
  )
}
