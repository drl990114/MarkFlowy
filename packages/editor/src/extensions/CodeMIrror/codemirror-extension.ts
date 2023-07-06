import { CodeMirrorExtension } from '@remirror/extension-codemirror6'
import type Token from 'markdown-it/lib/token'

import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import type { EditorState } from 'remirror'
import { findParentNodeOfType } from '@remirror/core'
import { Decoration, DecorationSet } from '@remirror/pm/view'
import createCodeMirrorMenuDecorations from './codemirror-lang-menu'

export const fakeIndentedLanguage = 'indent-code'

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

  createDecorations(state: EditorState): DecorationSet {
    const found = findParentNodeOfType({ types: this.type, selection: state.selection })
    if (!found) {
      return DecorationSet.empty
    }

    const languages = this.options.languages
    if (!languages || languages.length <= 1) {
      return DecorationSet.empty
    }

    const { create, destroy } = createCodeMirrorMenuDecorations(found)

    const deco = Decoration.widget(found.pos, create, {
      ignoreSelection: true,
      stopEvent: () => true,
      key: 'language-menu',
      destroy,
    })

    return DecorationSet.create(state.doc, [deco])
  }
}
