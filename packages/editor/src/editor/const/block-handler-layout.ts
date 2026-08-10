export const BLOCK_HANDLER_INLINE_SIZE = 42
export const BLOCK_HANDLER_CONTENT_GAP = 6
export const BLOCK_HANDLER_GUTTER_SIZE = BLOCK_HANDLER_INLINE_SIZE + BLOCK_HANDLER_CONTENT_GAP

export function getBlockHandlerLeft(blockLeft: number): number {
  return blockLeft - BLOCK_HANDLER_GUTTER_SIZE
}
