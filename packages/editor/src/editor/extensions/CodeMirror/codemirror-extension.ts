import type Token from 'markdown-it/lib/token.mjs'

import { languages } from '@codemirror/language-data'
import { placeholder } from '@codemirror/view'
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
  ProsemirrorNode
} from '@rme-sdk/core'
import {
  extension,
  findParentNodeOfType,
  isElementDomNode,
  isEqual,
  isTextSelection,
  NodeExtension,
  nodeInputRule,
  setBlockType,
} from '@rme-sdk/core'
import type { EditorState } from '@rme-sdk/main'
import { TextSelection } from '@rme-sdk/pm/state'
import { Decoration, DecorationSet } from '@rme-sdk/pm/view'
import { t } from '@markflowy/i18n'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import createCodeMirrorMenuDecorations from './codemirror-lang-menu'
import { CodeMirror6NodeView } from './codemirror-node-view'
import type { CodeMirrorExtensionAttributes, CodeMirrorExtensionOptions } from './codemirror-types'

export const fakeIndentedLanguage = 'indent-code'

@extension<CodeMirrorExtensionOptions>({
  defaultOptions: {
    hideDecoration: false,
    extensions: null,
    toggleName: 'paragraph',
    useProsemirrorHistoryKey: false,
    onCodemirrorViewLoad: () => {},
    showCopyButton: true,
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
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
      selectable: true,
      attrs: {
        ...extra.defaults(),
        'front-matter': { default: false },
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
      const baseExtensions = this.options.extensions ?? []
      if (node.attrs['front-matter'] === true) {
        baseExtensions.push(placeholder(t('codemirror.frontMatterPlaceholder')))
      }
      this.nodeview = new CodeMirror6NodeView({
        node,
        view,
        getPos: getPos as () => number,
        extensions: baseExtensions,
        toggleName: this.options.toggleName,
        options: {
          useProsemirrorHistoryKey: this.options.useProsemirrorHistoryKey,
          copyButton: {
            enabled: this.options.showCopyButton,
            customCopyFunction: this.options.customCopyFunction,
          },
          commandKeymapOptions: this.options.commandKeymapOptions,
        },
        onCodemirrorViewLoad: this.options.onCodemirrorViewLoad,
      })

      if (node.attrs['front-matter'] === true) {
        this.nodeview?.dom?.setAttribute('data-front-matter', 'true')
      }

      return this.nodeview
    }
  }

  /**
   * Create an input rule that listens converts the code fence into a code block
   * when typing triple back tick followed by a space.
   */
  createInputRules(): InputRule[] {
    const frontMatterRegexp = /^---$/
    const regexp = /^```(?!mermaid)(\S*) $/
    const getFrontMatterAttributes: GetAttributes = () => {
      return { 'front-matter': true, language: 'yaml' }
    }

    const getAttributes: GetAttributes = (match) => {
      const language = match[1] ?? ''
      return { language }
    }

    return [
      nodeInputRule({
        regexp: frontMatterRegexp,
        type: this.type,
        beforeDispatch: ({ tr, start }) => {
          const $pos = tr.doc.resolve(start)
          tr.setSelection(TextSelection.near($pos))
        },
        getAttributes: getFrontMatterAttributes,
        shouldSkip: ({ state, start }) => {
          const $pos = state.doc.resolve(start)
          return $pos.index(0) !== 0
        },
      }),
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

  enterKey = ({ dispatch, tr }: KeyBindingProps): boolean => {
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
  createCodeMirror = (attributes: CodeMirrorExtensionAttributes): CommandFunction => {
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
  updateCodeMirror = (attributes: CodeMirrorExtensionAttributes): CommandFunction => {
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

  createCommands() {
    return {
      createCodeMirror: this.createCodeMirror,
      updateCodeMirror: this.updateCodeMirror,
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
            'front-matter': tok.attrGet('front-matter') ?? false,
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
    if (node.attrs['front-matter'] === true) {
      state.write('---\n')
      state.write(node.textContent)
      if (!node.textContent.endsWith('\n')) {
        state.write('\n')
      }
      state.write('---\n')
      return
    } else if (node.attrs.language !== fakeIndentedLanguage) {
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
    if (!found || found.node.attrs['front-matter'] === true) {
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
