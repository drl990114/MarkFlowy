import type MarkdownIt from 'markdown-it'
import Token from 'markdown-it/lib/token.mjs'

const rule = (state: any) => {
  let edited = false
  const tokens = state.tokens
  let tokensLength = tokens.length

  for (let i = 0; i <= tokensLength - 1; i++) {
    const curToken = tokens[i] as Token

    if (curToken.type === 'math_block') {
      const originalContent = curToken.content || ''
      const mathToken = new Token('math_block', '', 0)
      ;(mathToken as any).attrs = { tex: curToken.attrs?.[0]?.[1] || '' }

      mathToken.content = originalContent
      mathToken.block = true
      mathToken.map = curToken.map

      tokens[i] = mathToken
      edited = true
    }

    let newTokens: Token[] = []
    if (curToken.type === 'inline' && curToken.children && curToken.children.some(t => t.type === 'math_inline')) {
      const inlineTokens = curToken.children
      inlineTokens.forEach(t => {
        if (t.type === 'math_inline') {
          const tex = (t.attrs as any)?.tex || ''
          const display = (t.attrs as any)?.display || false
          const originalContent = t.content || ''
          const mathToken = new Token('math_inline', '', 0)
          ;(mathToken as any).attrs = { tex, display }
          mathToken.content = originalContent
          newTokens.push(mathToken)
          edited = true
        } else {
          newTokens.push(t)
        }
      })

      tokens.splice(i, 1, ...newTokens)
      tokensLength += newTokens.length - 1
      continue
    }

  }

  return edited
}

function findClosingDelimiter(src: string, start: number, delimiter: string): number {
  let end = start
  while ((end = src.indexOf(delimiter, end)) !== -1) {
    let backslashes = 0
    let i = end - 1
    while (i >= 0 && src[i] === '\\') {
      backslashes++
      i--
    }
    if (backslashes % 2 === 0) break
    end++
  }
  return end
}

export default function MarkdownItMath(md: MarkdownIt) {
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    const pos = state.pos
    const ch = state.src.charCodeAt(pos)
    if (ch !== 0x24 /* $ */) return false

    const isDoubleDollar = state.src.charCodeAt(pos + 1) === 0x24
    if (isDoubleDollar && state.src.charCodeAt(pos + 2) === 0x24) return false

    const delimiter = isDoubleDollar ? '$$' : '$'
    const start = pos + delimiter.length
    const end = findClosingDelimiter(state.src, start, delimiter)

    if (end === -1) return false
    if (!silent) {
      const token = state.push('math_inline', '', 0)
      const tex = state.src.slice(start, end)
      token.attrs = { tex, display: isDoubleDollar } as any
    }
    state.pos = end + delimiter.length
    return true
  })

  md.block.ruler.after('fence', 'math_block', (state, startLine, endLine, silent) => {
    let pos = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    if (pos + 2 > max) return false
    if (state.src.charCodeAt(pos) !== 0x24 || state.src.charCodeAt(pos + 1) !== 0x24) return false

    const lineContent = state.src.slice(pos + 2, max)
    const closingIdx = lineContent.indexOf('$$')
    if (closingIdx !== -1) {
      const afterClosing = lineContent.slice(closingIdx + 2).trim()
      if (!afterClosing) {
        if (silent) return true
        const content = lineContent.slice(0, closingIdx).trim()
        const token = state.push('math_block', 'div', 0)
        token.block = true
        token.content = content
        token.attrs = [['tex', content]]
        token.map = [startLine, startLine + 1]
        state.line = startLine + 1
        return true
      }
    }

    pos += 2
    if (silent) return true

    let nextLine = startLine
    let found = false
    for (;;) {
      nextLine++
      if (nextLine >= endLine) break
      let lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      if (
        state.src.charCodeAt(lineStart) === 0x24 &&
        state.src.charCodeAt(lineStart + 1) === 0x24
      ) {
        found = true
        pos = lineStart + 2
        break
      }
    }
    if (!found) return false

    const content = state.getLines(startLine + 1, nextLine, state.tShift[startLine + 1], true)

    const token = state.push('math_block', 'div', 0)
    token.block = true
    token.content = content
    token.attrs = [['tex', content]]
    token.map = [startLine, nextLine + 1]
    state.line = nextLine + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  md.core.ruler.push('markdown-it-math', rule)
}
