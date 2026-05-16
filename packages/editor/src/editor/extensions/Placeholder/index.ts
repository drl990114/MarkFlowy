import type {
  CreateExtensionPlugin,
  OnSetOptionsProps,
  ProsemirrorAttributes,
} from '@rme-sdk/core'
import { extension, ManagerPhase, PlainExtension } from '@rme-sdk/core'
import type { EditorState } from '@rme-sdk/pm/state'
import { Decoration, DecorationSet } from '@rme-sdk/pm/view'

export interface PlaceholderOptions {
  /**
   * The placeholder text to use.
   */
  placeholder?: string

  /**
   * The class to decorate the empty top level node with. If you change this
   * then you will also need to apply your own styles.
   */
  emptyNodeClass?: string
}

export interface PlaceholderPluginState extends Required<PlaceholderOptions> {
  empty: boolean
}

/**
 * The placeholder extension which adds a placeholder annotation to an empty
 * document.
 */
@extension<PlaceholderOptions>({
  defaultOptions: {
    placeholder: '',
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: []
})
export class PlaceholderExtension extends PlainExtension<PlaceholderOptions> {
  get name() {
    return 'placeholder' as const
  }

  createAttributes(): ProsemirrorAttributes {
    return { 'aria-placeholder': this.options.placeholder }
  }

  createPlugin(): CreateExtensionPlugin {
    return {
      props: {
        decorations: (state) => createDecorationSet({ state, extension: this }),
      },
    }
  }

  protected onSetOptions(props: OnSetOptionsProps<PlaceholderOptions>): void {
    const { changes } = props

    if (changes.placeholder.changed && this.store.phase >= ManagerPhase.EditorView) {
      // update the attributes object
      this.store.updateAttributes()
    }
  }
}

interface SharedProps {
  /**
   * A reference to the extension
   */
  extension: PlaceholderExtension
  /**
   * The editor state
   */
  state: EditorState
}

/**
 * Creates a decoration set from the passed through state.
 *
 * @param props - see [[`SharedProps`]]
 */
function createDecorationSet(props: SharedProps) {
  const { extension: ext, state } = props
  const { emptyNodeClass, placeholder } = ext.options
  const decorations: any = []
  state.doc.descendants((node, pos, parent) => {
    if (
      node.type.name === 'paragraph' &&
      node.content.size === 0 &&
      placeholder &&
      state.selection.from - 1 === pos &&
      parent?.type.name === 'doc'
    ) {
      const placeholderDecoration = Decoration.node(pos, pos + node.nodeSize, {
        class: emptyNodeClass,
        'data-placeholder': placeholder,
      })
      decorations.push(placeholderDecoration)
    }
  })
  return DecorationSet.create(state.doc, decorations)
}
