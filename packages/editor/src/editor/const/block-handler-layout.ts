export const BLOCK_HANDLER_INLINE_SIZE = 42
export const BLOCK_HANDLER_CONTENT_GAP = 2
export const BLOCK_HANDLER_GUTTER_SIZE = BLOCK_HANDLER_INLINE_SIZE + BLOCK_HANDLER_CONTENT_GAP
export const BLOCK_HANDLER_CONTROL_BLOCK_SIZE = 24
export const BLOCK_HANDLER_HIT_PADDING_BLOCK = 4

export interface BlockHandlerVerticalGeometry {
  controlOffsetTop: number
  hitAreaBlockSize: number
  hitAreaTop: number
}

export function getBlockHandlerLeft(blockLeft: number): number {
  return blockLeft - BLOCK_HANDLER_GUTTER_SIZE
}

export function getBlockHandlerVerticalGeometry(
  anchorTop: number,
  anchorBottom: number,
  interactionTop = anchorTop,
  interactionBottom = anchorBottom,
): BlockHandlerVerticalGeometry {
  const anchorBlockSize = Math.max(0, anchorBottom - anchorTop)
  const controlTop = anchorTop + (anchorBlockSize - BLOCK_HANDLER_CONTROL_BLOCK_SIZE) / 2
  const hitAreaTop = Math.min(interactionTop, controlTop - BLOCK_HANDLER_HIT_PADDING_BLOCK)
  const hitAreaBottom = Math.max(
    interactionBottom,
    controlTop + BLOCK_HANDLER_CONTROL_BLOCK_SIZE + BLOCK_HANDLER_HIT_PADDING_BLOCK,
  )

  return {
    controlOffsetTop: controlTop - hitAreaTop,
    hitAreaBlockSize: hitAreaBottom - hitAreaTop,
    hitAreaTop,
  }
}
