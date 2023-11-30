import type Token from 'markdown-it/lib/token'

import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import type { EditorState } from 'remirror'
import { Decoration, DecorationSet } from '@remirror/pm/view'
import createCodeMirrorMenuDecorations from './codemirror-lang-menu'
import type {
  ApplySchemaAttributes,
  CommandFunction,
  EditorView,
  GetAttributes,
  InputRule,
  KeyBindingProps,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeViewMethod,
  PrioritizedKeyBindings,
  ProsemirrorNode,
} from '@remirror/core'
import {
  command,
  extension,
  findParentNodeOfType,
  isElementDomNode,
  isEqual,
  isTextSelection,
  keyBinding,
  NodeExtension,
  nodeInputRule,
  setBlockType,
} from '@remirror/core'
import { TextSelection } from '@remirror/pm/state'
import { CodeMirror6NodeView } from './codemirror-node-view'
import type { CodeMirrorExtensionAttributes, CodeMirrorExtensionOptions } from './codemirror-types'
import { arrowHandler } from './codemirror-utils'
import type { CreateThemeOptions} from '@/codemirror'
import { changeTheme } from '@/codemirror'
import { languages } from '@codemirror/language-data'

export const fakeIndentedLanguage = 'indent-code'

@extension<CodeMirrorExtensionOptions>({
  defaultOptions: {
    hideDecoration: false,
    extensions: null,
    toggleName: 'paragraph',
  },
})
export class LineCodeMirrorExtension extends NodeExtension<CodeMirrorExtensionOptions> {
  private nodeview: CodeMirror6NodeView | undefined
  get name() {
    return 'codeMirror' as const
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      group: 'block',
      content: 'text*',
      marks: '',
      defining: true,
      ...override,
      code: true,
      attrs: {
        ...extra.defaults(),
        language: { default: '' },
      },
      parseDOM: [
        {
          tag: 'pre',
          getAttrs: (node) => (isElementDomNode(node) ? extra.parse(node) : false),
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM() {
        return ['pre', ['code', 0]]
      },
      isolating: true,
    }
  }

  createNodeViews(): NodeViewMethod {
    return (node: ProsemirrorNode, view: EditorView, getPos: () => number | undefined) => {
      this.nodeview = new CodeMirror6NodeView({
        node,
        view,
        getPos: getPos as () => number,
        extensions: this.options.extensions,
        toggleName: this.options.toggleName,
      })

      return this.nodeview
    }
  }

  createKeymap(): PrioritizedKeyBindings {
    return {
      ArrowLeft: arrowHandler('left'),
      ArrowRight: arrowHandler('right'),
      ArrowUp: arrowHandler('up'),
      ArrowDown: arrowHandler('down'),
    }
  }

  /**
   * Create an input rule that listens converts the code fence into a code block
   * when typing triple back tick followed by a space.
   */
  createInputRules(): InputRule[] {
    const regexp = /^```(\S+) $/

    const getAttributes: GetAttributes = (match) => {
      const language = match[1] ?? ''
      return { language }
    }

    return [
      nodeInputRule({
        regexp,
        type: this.type,
        beforeDispatch: ({ tr, start }) => {
          const $pos = tr.doc.resolve(start)
          tr.setSelection(TextSelection.near($pos))
        },
        getAttributes: getAttributes,
      }),
    ]
  }

  @keyBinding({ shortcut: 'Enter' })
  enterKey({ dispatch, tr }: KeyBindingProps): boolean {
    if (!(isTextSelection(tr.selection) && tr.selection.empty)) {
      return false
    }

    const { nodeBefore, parent } = tr.selection.$anchor

    if (!nodeBefore?.isText || !parent.type.isTextblock) {
      return false
    }

    const regex = /^```(\S*)?$/
    const { text, nodeSize } = nodeBefore
    const { textContent } = parent

    if (!text) {
      return false
    }

    const matchesNodeBefore = text.match(regex)
    const matchesParent = textContent.match(regex)

    if (!matchesNodeBefore || !matchesParent) {
      return false
    }

    const language = matchesNodeBefore[1] ?? ''

    const pos = tr.selection.$from.before()
    const end = pos + nodeSize + 1 // +1 to account for the extra pos a node takes up
    tr.replaceWith(pos, end, this.type.create({ language }))

    // Set the selection to within the codeBlock
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))

    if (dispatch) {
      dispatch(tr)
    }

    return true
  }

  /**
   * Creates a CodeMirror block at the current position.
   *
   * ```ts
   * commands.createCodeMirror({ language: 'js' });
   * ```
   */
  @command()
  createCodeMirror(attributes: CodeMirrorExtensionAttributes): CommandFunction {
    return setBlockType(this.type, attributes)
  }

  /**
   * Update the code block at the current position. Primarily this is used
   * to change the language.
   *
   * ```ts
   * if (commands.updateCodeMirror.isEnabled()) {
   *   commands.updateCodeMirror({ language: 'markdown' });
   * }
   * ```
   */
  @command()
  updateCodeMirror(attributes: CodeMirrorExtensionAttributes): CommandFunction {
    const type = this.type
    return ({ state, dispatch, tr }) => {
      const parent = findParentNodeOfType({ types: type, selection: state.selection })

      if (!parent || isEqual(attributes, parent.node.attrs)) {
        // Do nothing since the attrs are the same
        return false
      }

      tr.setNodeMarkup(parent.pos, type, { ...parent.node.attrs, ...attributes })

      if (dispatch) {
        dispatch(tr)
      }

      return true
    }
  }

  @command()
  changeCodeMirrorTheme(theme: CreateThemeOptions): CommandFunction {
    return () => {
      changeTheme(theme)
      return true
    }
  }

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
    if (this.options.hideDecoration) {
      return DecorationSet.empty
    }

    const found = findParentNodeOfType({ types: this.type, selection: state.selection })
    if (!found) {
      return DecorationSet.empty
    }

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
