import emojiData from 'svgmoji/emoji-github.min.json'

import type { LineMarkAttrs, LineMarkName } from './inline-mark-extensions'
import type { InlineToken } from './inline-types'

type FormattingMarkName = 'mdHighlight' | 'mdSubscript' | 'mdSuperscript'

type FormattingMatch = {
  contentEnd: number
  contentStart: number
  end: number
  mark: FormattingMarkName
  start: number
}

type EmojiMatch = {
  emoji: string
  end: number
  start: number
}

const emojiByShortcode = new Map<string, string>()

for (const emoji of emojiData) {
  for (const shortcode of emoji.s) {
    if (!emojiByShortcode.has(shortcode)) {
      emojiByShortcode.set(shortcode, emoji.e)
    }
  }
}

const punctuationOrSymbol = /[\p{P}\p{S}]/u
const whitespace = /\s/u
const emojiShortcode = /:([a-zA-Z0-9_+-]+):/g

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && whitespace.test(char)
}

function isPunctuationOrSymbol(char: string | undefined): boolean {
  return char !== undefined && punctuationOrSymbol.test(char)
}

function canOpenDelimiter(text: string, start: number, length: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined
  const after = text[start + length]
  const leftFlanking =
    after !== undefined &&
    !isWhitespace(after) &&
    (!isPunctuationOrSymbol(after) ||
      before === undefined ||
      isWhitespace(before) ||
      isPunctuationOrSymbol(before))

  return leftFlanking
}

function canCloseDelimiter(text: string, start: number, length: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined
  const after = text[start + length]
  const rightFlanking =
    before !== undefined &&
    !isWhitespace(before) &&
    (!isPunctuationOrSymbol(before) ||
      after === undefined ||
      isWhitespace(after) ||
      isPunctuationOrSymbol(after))

  return rightFlanking
}

function createEligiblePositions(tokens: InlineToken[], textLength: number): boolean[] {
  const positions = Array.from({ length: textLength }, () => false)

  for (const token of tokens) {
    const excluded = token.marks.some((mark) =>
      ['mdMark', 'mdCodeText', 'mdCodeSpace', 'mdLinkUri'].includes(mark),
    )
    if (excluded) continue

    for (let index = Math.max(0, token.start); index < Math.min(textLength, token.end); index++) {
      positions[index] = true
    }
  }

  return positions
}

function isEligibleRange(positions: boolean[], start: number, end: number): boolean {
  if (start >= end) return false
  for (let index = start; index < end; index++) {
    if (!positions[index]) return false
  }
  return true
}

function findHighlightMatches(text: string, eligible: boolean[]): FormattingMatch[] {
  const openers: number[] = []
  const matches: FormattingMatch[] = []

  for (let index = 0; index < text.length - 1; index++) {
    if (
      text[index] !== '=' ||
      text[index + 1] !== '=' ||
      text[index - 1] === '=' ||
      text[index + 2] === '=' ||
      isEscaped(text, index) ||
      !isEligibleRange(eligible, index, index + 2)
    ) {
      continue
    }

    const canOpen = canOpenDelimiter(text, index, 2)
    const canClose = canCloseDelimiter(text, index, 2)

    if (canClose && openers.length > 0) {
      const start = openers.pop()!
      if (start + 2 < index && text.slice(start + 2, index).trim()) {
        matches.push({
          contentEnd: index,
          contentStart: start + 2,
          end: index + 2,
          mark: 'mdHighlight',
          start,
        })
      }
      index += 1
      continue
    }

    if (canOpen) {
      openers.push(index)
      index += 1
    }
  }

  return matches
}

function hasUnescapedWhitespace(text: string, start: number, end: number): boolean {
  for (let index = start; index < end; index++) {
    if (isWhitespace(text[index]) && !isEscaped(text, index)) return true
  }
  return false
}

function findSingleDelimiterMatches(
  text: string,
  eligible: boolean[],
  delimiter: '~' | '^',
  mark: FormattingMarkName,
): FormattingMatch[] {
  const matches: FormattingMatch[] = []

  for (let start = 0; start < text.length - 2; start++) {
    if (
      text[start] !== delimiter ||
      text[start - 1] === delimiter ||
      text[start + 1] === delimiter ||
      isEscaped(text, start) ||
      !eligible[start]
    ) {
      continue
    }

    let end = start + 1
    while (end < text.length) {
      if (
        text[end] === delimiter &&
        text[end - 1] !== delimiter &&
        text[end + 1] !== delimiter &&
        !isEscaped(text, end) &&
        eligible[end]
      ) {
        break
      }
      end += 1
    }

    if (
      end >= text.length ||
      end === start + 1 ||
      !isEligibleRange(eligible, start + 1, end) ||
      hasUnescapedWhitespace(text, start + 1, end)
    ) {
      continue
    }

    matches.push({
      contentEnd: end,
      contentStart: start + 1,
      end: end + 1,
      mark,
      start,
    })
    start = end
  }

  return matches
}

function isAutolinkToken(token: InlineToken, text: string): boolean {
  return (
    token.marks.includes('mdLinkText') &&
    typeof token.attrs.href === 'string' &&
    text.slice(token.start, token.end) === token.attrs.href
  )
}

function findEmojiMatches(text: string, tokens: InlineToken[], eligible: boolean[]): EmojiMatch[] {
  const matches: EmojiMatch[] = []
  emojiShortcode.lastIndex = 0

  for (const match of text.matchAll(emojiShortcode)) {
    const start = match.index
    const end = start + match[0].length
    const emoji = emojiByShortcode.get(match[1])
    if (
      !emoji ||
      isEscaped(text, start) ||
      !isEligibleRange(eligible, start, end) ||
      tokens.some(
        (token) => token.start <= start && token.end >= end && isAutolinkToken(token, text),
      )
    ) {
      continue
    }

    matches.push({ emoji, end, start })
  }

  return matches
}

function getSegmentAttrs(
  token: InlineToken,
  formattingMatches: FormattingMatch[],
  emojiMatch: EmojiMatch | undefined,
  start: number,
  end: number,
): LineMarkAttrs {
  if (emojiMatch?.start === start && emojiMatch.end === end) {
    return {
      ...token.attrs,
      depth: 1,
      emoji: emojiMatch.emoji,
      first: true,
      last: true,
    }
  }

  const delimiterMatch = formattingMatches.find(
    (match) =>
      (start >= match.start && end <= match.contentStart) ||
      (start >= match.contentEnd && end <= match.end),
  )
  if (delimiterMatch) {
    return {
      ...token.attrs,
      depth: 1,
      first: start === delimiterMatch.start,
      last: end === delimiterMatch.end,
    }
  }

  const contentMatch = formattingMatches.find(
    (match) => start >= match.contentStart && end <= match.contentEnd,
  )
  if (contentMatch) return { ...token.attrs, depth: 1 }

  return token.attrs
}

function getSegmentMarks(
  token: InlineToken,
  formattingMatches: FormattingMatch[],
  emojiMatch: EmojiMatch | undefined,
  start: number,
  end: number,
): LineMarkName[] {
  const isDelimiter = formattingMatches.some(
    (match) =>
      (start >= match.start && end <= match.contentStart) ||
      (start >= match.contentEnd && end <= match.end),
  )
  if (isDelimiter) return ['mdMark']

  const marks = new Set(token.marks)
  for (const match of formattingMatches) {
    if (start >= match.contentStart && end <= match.contentEnd) {
      marks.delete('mdText')
      marks.add(match.mark)
    }
  }
  if (emojiMatch) {
    marks.delete('mdText')
    marks.add('mdEmoji')
  }

  return [...marks]
}

export function applyExtendedInlineSyntax(tokens: InlineToken[], text: string): InlineToken[] {
  const eligible = createEligiblePositions(tokens, text.length)
  const formattingMatches = [
    ...findHighlightMatches(text, eligible),
    ...findSingleDelimiterMatches(text, eligible, '~', 'mdSubscript'),
    ...findSingleDelimiterMatches(text, eligible, '^', 'mdSuperscript'),
  ]
  const emojiMatches = findEmojiMatches(text, tokens, eligible)
  const boundaries = new Set<number>()

  for (const match of formattingMatches) {
    boundaries.add(match.start)
    boundaries.add(match.contentStart)
    boundaries.add(match.contentEnd)
    boundaries.add(match.end)
  }
  for (const match of emojiMatches) {
    boundaries.add(match.start)
    boundaries.add(match.end)
  }

  if (boundaries.size === 0) return tokens

  const output: InlineToken[] = []
  for (const token of tokens) {
    const tokenBoundaries = [...boundaries]
      .filter((boundary) => boundary > token.start && boundary < token.end)
      .sort((a, b) => a - b)
    const points = [token.start, ...tokenBoundaries, token.end]

    for (let index = 0; index < points.length - 1; index++) {
      const start = points[index]
      const end = points[index + 1]
      const emojiMatch = emojiMatches.find((match) => start >= match.start && end <= match.end)
      output.push({
        attrs: getSegmentAttrs(token, formattingMatches, emojiMatch, start, end),
        end,
        marks: getSegmentMarks(token, formattingMatches, emojiMatch, start, end),
        start,
      })
    }
  }

  return output
}
