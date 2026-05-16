import type {
    ApplySchemaAttributes,
    ExtensionCommandReturn,
    NodeExtensionSpec,
    NodeSpecOverride
} from '@rme-sdk/core'
import { extension, ExtensionTag, NodeExtension } from '@rme-sdk/core'
import { TextSelection } from '@rme-sdk/pm/state'
import type { NodeViewComponentProps } from '@rme-sdk/react'
import type { ComponentType } from 'react'
import { AINodeView } from './ai-nodeview'
import type { AIOptions } from './ai-types'

@extension<AIOptions>({
  defaultOptions: {
    supportProviderInfosMap: {
      openai: {
        models: ['gpt-3.5-turbo', 'gpt-4']
      },
    },
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class AIExtension extends NodeExtension<AIOptions> {
  get name() {
    return 'ai_block' as const
  }

  createTags() {
    return [ExtensionTag.Block, ExtensionTag.Media]
  }

  ReactComponent: ComponentType<NodeViewComponentProps> | undefined = (props) => {
    return (
      <AINodeView
        {...props}
        {...this.options}
      />
    )
  }

  createCommands(): ExtensionCommandReturn {
    return {
      createAiBlock: () => (props) => {
        const { tr, dispatch, state } = props
        if (!tr.selection.empty) {
          return false
        }

        const offset = tr.selection.anchor

        const node = this.type.create({})

        dispatch?.(
          tr
            .replaceSelectionWith(node)
            .scrollIntoView()
            .setSelection(TextSelection.near(tr.doc.resolve(offset))),
        )
        return true
      }
    }
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      inline: false,
      selectable: true,
      ...override,
      attrs: {
        ...extra.defaults(),
      },
    }
  }
}
