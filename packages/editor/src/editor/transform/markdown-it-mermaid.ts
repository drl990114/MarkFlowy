import type MarkdownIt from 'markdown-it'
import { Core, StateCore } from 'markdown-it/index.js'
import Token from 'markdown-it/lib/token.mjs'

const rule: Core.RuleCore = (state: StateCore) => {
  let edited = false
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

  return edited
}

function MarkdownItMermaid(md: MarkdownIt) {
  md.core.ruler.push('markdown-it-mermaid', rule)
}

export default MarkdownItMermaid
