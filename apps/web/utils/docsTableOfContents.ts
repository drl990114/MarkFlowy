export interface DocsTableOfContentsItem {
  id: string
  level: 2 | 3
  title: string
}

interface DocsTableOfContentsResult {
  html: string
  items: DocsTableOfContentsItem[]
}

const decodeHtmlEntities = (value: string) => {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  }

  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (_, entity: string) => {
    const normalizedEntity = entity.toLowerCase()

    if (normalizedEntity.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(2), 16))
    }

    if (normalizedEntity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(1), 10))
    }

    return namedEntities[normalizedEntity] || ''
  })
}

const getHeadingTitle = (content: string) => {
  return decodeHtmlEntities(content.replace(/<[^>]+>/g, '')).trim()
}

const createSlug = (title: string) => {
  return (
    title
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s_-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section'
  )
}

export const buildDocsTableOfContents = (sourceHtml: string): DocsTableOfContentsResult => {
  const items: DocsTableOfContentsItem[] = []
  const slugCounts = new Map<string, number>()
  const headingPattern = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi

  const html = sourceHtml.replace(
    headingPattern,
    (heading, levelValue: string, attributes: string, content: string) => {
      const title = getHeadingTitle(content)

      if (!title) {
        return heading
      }

      const existingId = attributes.match(/\sid=(['"])(.*?)\1/i)?.[2]
      const baseId = existingId || createSlug(title)
      const duplicateIndex = slugCounts.get(baseId) || 0
      const id = duplicateIndex === 0 ? baseId : `${baseId}-${duplicateIndex}`
      const level = Number(levelValue) as 2 | 3

      slugCounts.set(baseId, duplicateIndex + 1)
      items.push({ id, level, title })

      if (existingId && existingId === id) {
        return heading
      }

      const attributesWithoutId = attributes.replace(/\sid=(['"])(.*?)\1/i, '')
      return `<h${levelValue}${attributesWithoutId} id="${id}">${content}</h${levelValue}>`
    },
  )

  return { html, items }
}
