import type { IHeadingData } from '@markflowy/interface'

interface Choice {
  heading: IHeadingData
  title: string
  parent: Choice | undefined
  searchTitle: string
  searchPath: string
}

const fold = (text: string) => text.normalize('NFKC').toLowerCase()

/** Built from the published outline, never the document text or visible DOM. */
export function indexOutlineHeadings(headings: readonly IHeadingData[]): Choice[] {
  const ancestors: Choice[] = []
  return headings.map((heading) => {
    while (ancestors.length && ancestors[ancestors.length - 1].heading.depth >= heading.depth) {
      ancestors.pop()
    }
    const title = [heading.chapter, heading.value].filter(Boolean).join(' ').trim()
    const last = ancestors.at(-1)
    const parent = last?.title ? last : last?.parent
    const searchPath = parent?.searchPath ? `${parent.searchPath} › ${parent.searchTitle}` : parent?.searchTitle ?? ''
    const choice: Choice = { heading, title, parent, searchTitle: fold(title), searchPath }
    ancestors.push(choice)
    return choice
  })
}

/** Walk only a visible row's ancestors; keep each title's Markdown independent. */
export function getOutlineBreadcrumb(parent: Choice): Choice[] {
  const parts: Choice[] = []
  for (let choice: Choice | undefined = parent; choice; choice = choice.parent) parts.push(choice)
  return parts.reverse()
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
