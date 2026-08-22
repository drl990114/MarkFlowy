import type MarkdownIt from 'markdown-it'
import type { Core, StateCore } from 'markdown-it/index.js'
import Token from 'markdown-it/lib/token.mjs'

function isListItemToken(t: Token) {
  return t.type === 'list_item_open'
}
function isParagraphOpenToken(t: Token) {
  return t.type === 'paragraph_open'
}
function isInlineToken(t: Token) {
  return t.type === 'inline'
}

const rule: Core.RuleCore = (state: StateCore) => {
  let edited = false
  const tokens = state.tokens
  const tokensLength = tokens.length
  for (let i = tokensLength - 3; i >= 0; i--) {
    const curToken = tokens[i]
    if (
      isListItemToken(curToken) &&
      isParagraphOpenToken(tokens[i + 1]) &&
      isInlineToken(tokens[i + 2])
    ) {
      const inlineToken = tokens[i + 2]
      const match = /^\[([ xX])\](?:[ \t]+|$)/.exec(inlineToken.content)

      if (match) {
        const checked = match[1].toLowerCase() === 'x'
        const checkboxPrefix = match[0]

        // 更新 inlineToken.content，移除checkbox标记
        inlineToken.content = inlineToken.content.slice(checkboxPrefix.length)

        // 更新第一个text子节点的内容，避免重复
        if (inlineToken.children && inlineToken.children.length > 0) {
          const firstTextChild = inlineToken.children.find((child) => child.type === 'text')
          if (firstTextChild) {
            // 确保只修改一次，避免重复赋值
            const originalContent = firstTextChild.content
            if (originalContent.startsWith(checkboxPrefix)) {
              firstTextChild.content = originalContent.slice(checkboxPrefix.length)
            }
          }
        }

        const checkboxToken = new Token('list_checkbox', 'input', 0)
        checkboxToken.level = tokens[i + 1].level
        checkboxToken.attrPush(['type', 'checkbox'])
        if (checked) {
          checkboxToken.attrPush(['checked', ''])
        }
        tokens.splice(i + 1, 0, checkboxToken)
        edited = true
      }
    }
  }
  return edited
}

// A markdown-it plugin for selectable list checkbox
function MarkdownItListCheckbox(md: MarkdownIt) {
  md.core.ruler.push('markdown-it-list-checkbox', rule)
}

export default MarkdownItListCheckbox
