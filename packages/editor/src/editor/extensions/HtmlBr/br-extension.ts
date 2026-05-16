import type {
    ApplySchemaAttributes,
    InputRule,
    NodeExtensionSpec,
    NodeSpecOverride,
} from '@rme-sdk/core'
import { extension, ExtensionTag, NodeExtension, nodeInputRule } from '@rme-sdk/core'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'

export interface HtmlBrOptions {}

@extension<HtmlBrOptions>({
  defaultOptions: {},
})
export class HtmlBrExtension extends NodeExtension<HtmlBrOptions> {
  static disableExtraAttributes = true

  get name() {
    return 'html_br' as const
  }

  createTags() {
    return [ExtensionTag.InlineNode]
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      inline: true,
      selectable: true,
      atom: true,
      ...override,
      attrs: {},
      parseDOM: [
        {
          tag: 'br',
        },
      ],
      toDOM: () => {
        return ['br']
      },
    }
  }

  createInputRules(): InputRule[] {
    const rules: InputRule[] = [
      nodeInputRule({
        regexp: new RegExp('<br/>'),
        type: this.type,
      }),
    ]

    return rules
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.inline,
        token: 'html_br',
        node: this.name,
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    state.text('<br/>', false)
  }
}
