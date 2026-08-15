import { describe, expect, it } from 'vitest'
import {
  BLOCK_HANDLER_CONTENT_GAP,
  BLOCK_HANDLER_GUTTER_SIZE,
  BLOCK_HANDLER_INLINE_SIZE,
  getBlockHandlerLeft,
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
})
