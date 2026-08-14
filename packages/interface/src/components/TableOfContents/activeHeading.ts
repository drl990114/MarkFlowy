type ActiveHeadingInput = {
  activeId?: string
  activeNodeKey?: number
  firstHeadingKey?: number
  headingId: string
  headingKey: number
}

export const isTableOfContentsHeadingActive = ({
  activeId,
  activeNodeKey,
  firstHeadingKey,
  headingId,
  headingKey,
}: ActiveHeadingInput) => {
  if (activeId) return headingId === activeId
  if (activeNodeKey !== undefined) return headingKey === activeNodeKey
  return headingKey === firstHeadingKey
}
