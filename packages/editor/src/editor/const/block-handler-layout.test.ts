import { describe, expect, it } from 'vitest'
import {
  BLOCK_HANDLER_CONTROL_BLOCK_SIZE,
  BLOCK_HANDLER_CONTENT_GAP,
  BLOCK_HANDLER_GUTTER_SIZE,
  BLOCK_HANDLER_HIT_PADDING_BLOCK,
  BLOCK_HANDLER_INLINE_SIZE,
  getBlockHandlerLeft,
  getBlockHandlerVerticalGeometry,
} from './block-handler-layout'

describe('block handler layout', () => {
  it('keeps the visible handler outside the content with a stable gap', () => {
    expect(BLOCK_HANDLER_GUTTER_SIZE).toBe(
      BLOCK_HANDLER_INLINE_SIZE + BLOCK_HANDLER_CONTENT_GAP,
    )
    expect(getBlockHandlerLeft(100) + BLOCK_HANDLER_INLINE_SIZE).toBe(
      100 - BLOCK_HANDLER_CONTENT_GAP,
    )
  })

  it('covers the full gutter with the handler interaction area', () => {
    expect(
      getBlockHandlerLeft(100) + BLOCK_HANDLER_INLINE_SIZE + BLOCK_HANDLER_CONTENT_GAP,
    ).toBe(100)
  })

  it('centers the visible control while padding the pointer hit area', () => {
    const geometry = getBlockHandlerVerticalGeometry(100, 124)

    expect(geometry).toEqual({
      controlOffsetTop: BLOCK_HANDLER_HIT_PADDING_BLOCK,
      hitAreaBlockSize:
        BLOCK_HANDLER_CONTROL_BLOCK_SIZE + BLOCK_HANDLER_HIT_PADDING_BLOCK * 2,
      hitAreaTop: 100 - BLOCK_HANDLER_HIT_PADDING_BLOCK,
    })
  })

  it('keeps a continuous vertical pointer corridor beside tall blocks', () => {
    const geometry = getBlockHandlerVerticalGeometry(100, 124, 96, 420)

    expect(geometry.hitAreaTop).toBe(96)
    expect(geometry.hitAreaTop + geometry.hitAreaBlockSize).toBe(420)
    expect(geometry.controlOffsetTop).toBe(4)
  })
})
