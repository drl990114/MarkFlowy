import type MarkdownIt from '@/markdown-it'
import type Core from '@/markdown-it/lib/parser_core'
import type StateCore from '@/markdown-it/lib/rules_core/state_core'
import Token from '@/markdown-it/lib/token'
import { getTagName } from '@/utils/html'
// @ts-ignore
import HTML from 'html-parse-stringify'

export const needSplitInlineHtmlTokenTags = ['img', 'iframe']

const typeMap: Record<string, string> = {
  img: 'html_image',
  iframe: 'iframe_inline',
}

const getAttrsBySignalHtmlContent = (html: string) => {
  const ast = HTML.parse(html)
  return ast[0]?.attrs || {}
}

function splitHtmlInlineTokens(t: Token) {
  if (!t.children) return []

  return t.children.map((child) => {
    if (isHtmlInlineToken(child) && needSplitInlineHtmlTokenTags.includes(child.tag)) {
      const newToken = new Token(typeMap[child.tag], '', 0)
      newToken.content = child.content
      newToken.attrs = getAttrsBySignalHtmlContent(child.content)
      return newToken
    } else {
      const token = new Token('text', '', 0)
      token.content = child.content
      return token
    }
  })
}

function isInlineToken(t: Token) {
  return t.type === 'inline'
}

function isHtmlInlineToken(t: Token) {
  return t.type === 'html_inline'
}

function hasSplitInlineHtmlToken(t: Token) {
  return t.children?.some((child) => {
    if (isHtmlInlineToken(child)) {
      const tag = getTagName(child.content)
      child.tag = tag
      return needSplitInlineHtmlTokenTags.includes(child.tag)
    } else {
      return false
    }
  })
}

const rule: Core.RuleCore = (state: StateCore) => {
  const edited = false
  const tokens = state.tokens
  const tokensLength = tokens.length
  for (let i = tokensLength - 1; i >= 0; i--) {
    if (isInlineToken(tokens[i])) {
      const curToken = tokens[i]
      if (hasSplitInlineHtmlToken(curToken)) {
        tokens.splice(i, 1, ...splitHtmlInlineTokens(curToken))
      }
    }
  }

  return edited
}

function MarkdownItHtmlInline(md: MarkdownIt) {
  md.core.ruler.push('markdown-it-html-inline', rule)
}

export default MarkdownItHtmlInline
