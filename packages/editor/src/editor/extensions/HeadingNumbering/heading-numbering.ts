import type { Node as ProsemirrorNode } from '@rme-sdk/sdk/pm/model'
import type { Transaction } from '@rme-sdk/sdk/pm/state'

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type HeadingNumberingInput = {
  level: number
  text: string
  pos?: number
}

export type AnalyzedHeadingNumber = HeadingNumberingInput & {
  level: HeadingLevel
  counters: number[]
  prefix: string | null
  prefixLength: number
  title: string
}

export type HeadingNumberingAnalysis = {
  complete: boolean
  entries: AnalyzedHeadingNumber[]
  hasHeadings: boolean
}

const PREFIX_TOKEN_RE = /^(\S+?)(?:、[\t ]*|[\t ]+|$)/

export function normalizeHeadingLevel(level: number): HeadingLevel {
  return Math.min(6, Math.max(1, Math.trunc(level))) as HeadingLevel
}

function getHeadingCounters(inputs: readonly HeadingNumberingInput[]) {
  if (inputs.length === 0) {
    return { baseLevel: null, counters: [] } as const
  }

  const baseLevel = Math.min(
    ...inputs.map((input) => normalizeHeadingLevel(input.level)),
  ) as HeadingLevel
  const levelCounters = [0, 0, 0, 0, 0, 0, 0]
  const counters = inputs.map((input) => {
    const level = normalizeHeadingLevel(input.level)
    levelCounters[level] += 1
    for (let deeperLevel = level + 1; deeperLevel <= 6; deeperLevel += 1) {
      levelCounters[deeperLevel] = 0
    }
    return levelCounters.slice(baseLevel, level + 1)
  })

  return { baseLevel, counters } as const
}

export function analyzeHeadingNumbering(
  inputs: readonly HeadingNumberingInput[],
): HeadingNumberingAnalysis {
  const { counters } = getHeadingCounters(inputs)

  const entries = inputs.map<AnalyzedHeadingNumber>((input, index) => {
    const level = normalizeHeadingLevel(input.level)
    const match = PREFIX_TOKEN_RE.exec(input.text)
    const token = match?.[1] ?? ''
    const segments = token ? token.split('.') : []
    const entryCounters = counters[index] ?? []
    const recognized =
      Boolean(token) &&
      segments.length === entryCounters.length &&
      segments.every((segment, segmentIndex) => segment === String(entryCounters[segmentIndex]))

    const prefixLength = recognized ? (match?.[0].length ?? token.length) : 0
    return {
      ...input,
      level,
      counters: entryCounters,
      prefix: recognized ? token : null,
      prefixLength,
      title: recognized ? input.text.slice(prefixLength) : input.text,
    }
  })

  const complete = entries.length > 0 && entries.every((entry) => entry.prefix !== null)

  return {
    complete,
    entries,
    hasHeadings: entries.length > 0,
  }
}

export function collectHeadingNumbering(doc: ProsemirrorNode): HeadingNumberingInput[] {
  const headings: HeadingNumberingInput[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') {
      return true
    }
    headings.push({
      level: normalizeHeadingLevel(Number(node.attrs.level)),
      text: node.textContent,
      pos,
    })
    return false
  })
  return headings
}

export function analyzeHeadingNumberingDocument(doc: ProsemirrorNode): HeadingNumberingAnalysis {
  return analyzeHeadingNumbering(collectHeadingNumbering(doc))
}

export function createHeadingPrefixes(inputs: readonly HeadingNumberingInput[]): string[] {
  const { baseLevel, counters } = getHeadingCounters(inputs)
  if (!baseLevel) {
    return []
  }
  return counters.map((entryCounters) => entryCounters.join('.'))
}

function getLoosePrefixLength(
  text: string,
  expectedSegments: number,
  knownTitles?: ReadonlySet<string>,
): number {
  const match = PREFIX_TOKEN_RE.exec(text)
  const token = match?.[1]
  if (!token) {
    return 0
  }
  const segments = token.split('.')
  if (segments.length !== expectedSegments) {
    return 0
  }
  if (!segments.every((segment) => /^\d+$/.test(segment))) {
    return 0
  }
  const remainingTitle = text.slice(match[0].length)
  return !knownTitles || knownTitles.has(remainingTitle) ? match[0].length : 0
}

export type RewriteHeadingNumberingOptions = {
  previousAnalysis?: HeadingNumberingAnalysis
  replaceLoosePrefixes?: boolean
}

export function rewriteHeadingNumbering(
  tr: Transaction,
  options: RewriteHeadingNumberingOptions = {},
): Transaction {
  const inputs = collectHeadingNumbering(tr.doc)
  const analysis = analyzeHeadingNumbering(inputs)
  const prefixes = createHeadingPrefixes(inputs)
  const knownTitles = new Set(options.previousAnalysis?.entries.map((entry) => entry.title) ?? [])
  const canReplaceLoosePrefixes =
    options.replaceLoosePrefixes && analysis.entries.some((entry) => entry.prefix)

  for (let index = inputs.length - 1; index >= 0; index -= 1) {
    const input = inputs[index]
    const entry = analysis.entries[index]
    const from = (input.pos ?? 0) + 1
    const loosePrefixLength =
      !entry.prefix && (options.previousAnalysis || canReplaceLoosePrefixes)
        ? getLoosePrefixLength(
            input.text,
            entry.counters.length,
            options.previousAnalysis ? knownTitles : undefined,
          )
        : 0
    const deleteLength = entry.prefixLength || loosePrefixLength
    const nextPrefix = prefixes[index]
    const nextText = `${nextPrefix}、`

    if (deleteLength > 0) {
      tr.delete(from, from + deleteLength)
    }
    if (nextText) {
      tr.insert(from, tr.doc.type.schema.text(nextText))
    }
  }

  return tr
}

export function removeHeadingNumbering(tr: Transaction): Transaction {
  const analysis = analyzeHeadingNumberingDocument(tr.doc)
  for (let index = analysis.entries.length - 1; index >= 0; index -= 1) {
    const entry = analysis.entries[index]
    if (!entry.prefixLength || entry.pos == null) {
      continue
    }
    tr.delete(entry.pos + 1, entry.pos + 1 + entry.prefixLength)
  }
  return tr
}

export function hasHeadingStructureChanged(
  previous: HeadingNumberingAnalysis,
  next: HeadingNumberingAnalysis,
): boolean {
  if (previous.entries.length !== next.entries.length) {
    return true
  }

  if (previous.entries.some((entry, index) => entry.level !== next.entries[index]?.level)) {
    return true
  }

  const knownTitles = new Set(previous.entries.map((entry) => entry.title))
  const nextTitles = next.entries.map((nextEntry) => {
    if (nextEntry.prefix) {
      return nextEntry.title
    }
    const match = PREFIX_TOKEN_RE.exec(nextEntry.text)
    return match && knownTitles.has(nextEntry.text.slice(match[0].length))
      ? nextEntry.text.slice(match[0].length)
      : nextEntry.text
  })

  if (previous.entries.every((entry, index) => entry.title === nextTitles[index])) {
    return false
  }
  if (nextTitles.some((title) => !knownTitles.has(title))) {
    return false
  }

  const previousTitleCounts = new Map<string, number>()
  const nextTitleCounts = new Map<string, number>()
  for (const entry of previous.entries) {
    previousTitleCounts.set(entry.title, (previousTitleCounts.get(entry.title) ?? 0) + 1)
  }
  for (const title of nextTitles) {
    nextTitleCounts.set(title, (nextTitleCounts.get(title) ?? 0) + 1)
  }

  return [...previousTitleCounts].every(([title, count]) => nextTitleCounts.get(title) === count)
}
