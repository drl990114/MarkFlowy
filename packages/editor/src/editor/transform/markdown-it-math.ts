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
      // If the inline token contains math_inline children, we need to process them
      const inlineTokens = curToken.children
      inlineTokens.forEach(t => {
        if (t.type === 'math_inline') {
          const tex = (t.attrs as any)?.tex || ''
          const originalContent = t.content || ''
          const mathToken = new Token('math_inline', '', 0)
          ;(mathToken as any).attrs = { tex }
          mathToken.content = originalContent
          newTokens.push(mathToken)
          edited = true
        } else {
          newTokens.push(t)
        }
      })

      // Replace the current inline token with the new tokens
      tokens.splice(i, 1, ...newTokens)
      tokensLength += newTokens.length - 1
      continue
    }

  }

  return edited
}

// Minimal $...$ and $$...$$ tokenizer producing tokens: math_inline and math_block
export default function MarkdownItMath(md: MarkdownIt) {
  // Inline math: $...$
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    const pos = state.pos
    const ch = state.src.charCodeAt(pos)
    if (ch !== 0x24 /* $ */) return false
    // avoid $$ here, handled by block rule
    if (state.src.charCodeAt(pos + 1) === 0x24) return false

    let start = pos + 1
    let end = start
    while ((end = state.src.indexOf('$', end)) !== -1) {
      // ensure not escaped
      let backslashes = 0
      let i = end - 1
      while (i >= 0 && state.src[i] === '\\') {
        backslashes++
        i--
      }
      if (backslashes % 2 === 0) break
      end++
    }
    if (end === -1) return false
    if (!silent) {
      const token = state.push('math_inline', '', 0)
      const tex = state.src.slice(start, end)
      const originalContent = state.src.slice(pos, end + 1) // 包含$标签的原始内容
      token.attrs = { tex } as any
      // token.content = tex
    }
    state.pos = end + 1
    return true
  })

  // Block math: $$...$$
  md.block.ruler.after('fence', 'math_block', (state, startLine, endLine, silent) => {
    let pos = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    if (pos + 2 > max) return false
    if (state.src.charCodeAt(pos) !== 0x24 || state.src.charCodeAt(pos + 1) !== 0x24) return false
    pos += 2
    if (silent) return true

    // search for closing $$
    let nextLine = startLine
    let found = false
    let content = ''
    for (;;) {
      nextLine++
      if (nextLine >= endLine) break
      let lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lineEnd = state.eMarks[nextLine]
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

    // Aggregate content between lines
    content = state.getLines(startLine + 1, nextLine, state.tShift[startLine + 1], true)

    // 构建包含$$标签的原始内容
    const originalContent = state.getLines(startLine, nextLine + 1, state.tShift[startLine], true)

    const token = state.push('math_block', 'div', 0)
    token.block = true
    token.content = content
    token.attrs = [['tex', content]]
    token.map = [startLine, nextLine + 1]
    state.line = nextLine + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  // Add core rule to process math tokens
  md.core.ruler.push('markdown-it-math', rule)
}


