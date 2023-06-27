import { CodeMirrorExtension } from '@remirror/extension-codemirror6'
import type Token from 'markdown-it/lib/token'

import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'

const fakeIndentedLanguage = 'indent-code'
export class LineCodeMirrorExtension extends CodeMirrorExtension {
  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'fence',
        node: this.name,
        hasOpenClose: false,
        getAttrs: (tok: Token) => {
          const language = tok.info
          return {
            language,
          }
        },
      },
      {
        type: ParserRuleType.block,
        token: 'code_block',
        node: this.name,
        hasOpenClose: false,
        getAttrs: () => {
          return {
            language: fakeIndentedLanguage,
          }
        },
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    if (node.attrs.language !== fakeIndentedLanguage) {
      state.write('```' + ((node.attrs.language as string) || '') + '\n')
      state.text(node.textContent, false)
      state.text('\n')
      state.write('```')
      state.closeBlock(node)
    } else {
      state.wrapBlock('    ', '    ', node, () => state.renderContent(node))
      state.closeBlock(node)
    }
    state.ensureNewLine()
  }
}
