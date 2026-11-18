import type { IHeadingData } from '@markflowy/interface'

interface Choice {
  heading: IHeadingData
  title: string
  parents: string
  searchTitle: string
  searchPath: string
}

const fold = (text: string) => text.normalize('NFKC').toLowerCase()

/** Built from the published outline, never the document text or visible DOM. */
export function indexOutlineHeadings(headings: readonly IHeadingData[]): Choice[] {
  const ancestors: { depth: number; title: string }[] = []
  return headings.map((heading) => {
    while (ancestors.length && ancestors[ancestors.length - 1].depth >= heading.depth) {
      ancestors.pop()
    }
    const title = [heading.chapter, heading.value].filter(Boolean).join(' ').trim()
    const parents = ancestors.map((ancestor) => ancestor.title).filter(Boolean).join(' › ')
    ancestors.push({ depth: heading.depth, title })
    return { heading, title, parents, searchTitle: fold(title), searchPath: fold(parents) }
  })
}

export function matchOutlineHeadings(choices: readonly Choice[], query: string): readonly Choice[] {
  const tokens = fold(query).trim().split(/\s+/u).filter(Boolean)
  if (!tokens.length) return choices
  // At least one term belongs to the heading itself. Searching a parent should
  // not return all its descendants, but "Chapter two Summary" can find a
  // specific Summary even if several sections have one.
  return choices.filter(({ searchTitle, searchPath }) =>
    tokens.some((token) => searchTitle.includes(token)) &&
    tokens.every((token) => searchTitle.includes(token) || searchPath.includes(token)),
  )
}
