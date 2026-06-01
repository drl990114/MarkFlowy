import type {
  CommandFunction,
  CreateExtensionPlugin,
  OnSetOptionsProps,
  ProsemirrorAttributes,
} from '@rme-sdk/core'
import { extension, ManagerPhase, PlainExtension } from '@rme-sdk/core'
import type { EditorState } from '@rme-sdk/pm/state'
import { Decoration, DecorationSet } from '@rme-sdk/pm/view'

export interface PlaceholderOptions {
  placeholder?: string
  emptyNodeClass?: string
  enabled?: boolean
}

export interface PlaceholderPluginState extends Required<PlaceholderOptions> {
  empty: boolean
}

@extension<PlaceholderOptions>({
  defaultOptions: {
    placeholder: '',
    enabled: true,
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: []
})
export class PlaceholderExtension extends PlainExtension<PlaceholderOptions> {
  get name() {
    return 'placeholder' as const
  }

  togglePlaceholder = (enabled?: boolean): CommandFunction => {
    return ({ dispatch }) => {
      if (!dispatch) {
        return true
      }
      const newEnabled = enabled !== undefined ? enabled : !this.options.enabled
      this.setOptions({ enabled: newEnabled })
      return true
    }
  }

  createCommands() {
    return {
      togglePlaceholder: this.togglePlaceholder,
    }
  }

  createAttributes(): ProsemirrorAttributes {
    if (!this.options.enabled) {
      return {}
    }
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

    if (
      (changes.placeholder.changed || changes.enabled.changed) &&
      this.store.phase >= ManagerPhase.EditorView
    ) {
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
  const { emptyNodeClass, placeholder, enabled } = ext.options

  if (!enabled || !placeholder) {
    return DecorationSet.create(state.doc, [])
  }

  const decorations: any = []
  state.doc.descendants((node, pos, parent) => {
    if (
      node.type.name === 'paragraph' &&
      node.content.size === 0 &&
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
