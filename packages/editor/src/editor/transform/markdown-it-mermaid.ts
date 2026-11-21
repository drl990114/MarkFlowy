import type MarkdownIt from 'markdown-it'
import type { RuleCore } from 'markdown-it/lib/parser_core.mjs'
import Token from 'markdown-it/lib/token.mjs'

const rule: RuleCore = (state) => {
  const tokens = state.tokens
  const tokensLength = tokens.length
  for (let i = 0; i <= tokensLength - 1; i++) {
    const curToken = tokens[i]

    if (curToken.type === 'fence' && curToken.info === 'mermaid') {
      const code = curToken.content
      const mermaidToken = new Token('mermaid_node', '', 0)
      mermaidToken.content = code

      tokens[i] = mermaidToken
    }
  }

  return false
}

function MarkdownItMermaid(md: MarkdownIt) {
  md.core.ruler.push('markdown-it-mermaid', rule)
}

export default MarkdownItMermaid
