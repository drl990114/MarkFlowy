import type MarkdownIt from 'markdown-it'
import type Core from 'markdown-it/lib/parser_core'
import type StateCore from 'markdown-it/lib/rules_core/state_core'
import type Token from 'markdown-it/lib/token'

function isHtmlText(t: string) {
  return t.startsWith('<') && t.endsWith('>')
}

const rule: Core.RuleCore = (state: StateCore) => {
  const edited = false
  const tokens = state.tokens
  const tokensLength = tokens.length
  console.log('tokens', tokens)

  for (let i = tokensLength - 1; i >= 0; i--) {
    if (tokens[i].type === 'inline' && tokens[i].content && isHtmlText(tokens[i].content)) {
      const token = new state.Token('html_block', '', 0)
      token.content = tokens[i].content
      token.map = [i, i + 1]
      token.info = 'html'
      tokens.splice(i, 1, token)
    }
  }
  return edited
}

function markdownHtml5embed(md: MarkdownIt) {
  md.core.ruler.push('markdown-it-html5-embed', rule)
}

export default markdownHtml5embed
