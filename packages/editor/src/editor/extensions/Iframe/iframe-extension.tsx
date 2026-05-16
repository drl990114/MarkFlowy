import type {
  ApplySchemaAttributes,
  CommandFunction,
  InputRule,
  LiteralUnion,
  NodeExtensionSpec,
  NodeSpecOverride,
  ProsemirrorAttributes,
} from '@rme-sdk/core'
import {
  cx,
  extension,
  ExtensionTag,
  NodeExtension,
  nodeInputRule,
  omitExtraAttributes,
} from '@rme-sdk/core'
import type { NodeViewComponentProps } from '@rme-sdk/react'
import type { ComponentType } from 'react'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import { buildHtmlStringFromAst, getAttrsBySignalHtmlContent } from '../../utils/html'
import { IframeNodeView } from './Iframe-nodeview'
import type { IframeOptions } from './iframe-types'

export type IframeAttributes = ProsemirrorAttributes<{
  src: string
  frameBorder?: number | string
  allowFullScreen?: 'true' | boolean
  width?: number
  height?: number
  type?: LiteralUnion<'youtube', string>
}>

/**
 * An extension for the remirror editor.
 */
@extension<IframeOptions>({
  defaultOptions: {
    defaultSource: '',
    class: 'remirror-iframe',
    enableResizing: false,
  },
  staticKeys: ['defaultSource', 'class'],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class IframeExtension extends NodeExtension<IframeOptions> {
  get name() {
    return 'iframe_inline' as const
  }

  createTags() {
    return [ExtensionTag.InlineNode, ExtensionTag.Media]
  }

  ReactComponent: ComponentType<NodeViewComponentProps> | undefined = (props) => {
    return <IframeNodeView {...props} />
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    const { defaultSource } = this.options

    return {
      inline: true,
      selectable: true,
      atom: true,
      ...override,
      attrs: {
        ...extra.defaults(),
        src: defaultSource ? { default: defaultSource } : {},
        allowFullScreen: { default: true },
        frameBorder: { default: 0 },
        type: { default: 'custom' },
        width: { default: null },
        height: { default: null },
      },
      parseDOM: [
        {
          tag: 'iframe',
          getAttrs: (dom): IframeAttributes => {
            const frameBorder = (dom as HTMLElement).getAttribute('frameborder')
            const width = (dom as HTMLElement).getAttribute('width')
            const height = (dom as HTMLElement).getAttribute('height')
            return {
              ...extra.parse(dom),
              type: (dom as HTMLElement).getAttribute('data-embed-type') ?? undefined,
              height: (height && Number.parseInt(height, 10)) || undefined,
              width: (width && Number.parseInt(width, 10)) || undefined,
              allowFullScreen:
                (dom as HTMLElement).getAttribute('allowfullscreen') === 'false' ? false : true,
              frameBorder: frameBorder ? Number.parseInt(frameBorder, 10) : 0,
              src: (dom as HTMLElement).getAttribute('src') ?? '',
            }
          },
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM: (node) => {
        const { frameBorder, allowFullScreen, src, type, ...rest } = omitExtraAttributes(
          node.attrs,
          extra,
        )
        const { class: className } = this.options

        return [
          'iframe',
          {
            ...extra.dom(node),
            ...rest,
            class: cx(className, `${className}-${type as string}`),
            src,
            'data-embed-type': type,
            allowfullscreen: allowFullScreen ? 'true' : 'false',
            frameBorder: frameBorder?.toString(),
          },
        ]
      },
    }
  }

  addIframe = (attributes: IframeAttributes): CommandFunction => {
    return ({ tr, dispatch }) => {
      dispatch?.(tr.replaceSelectionWith(this.type.create(attributes)))

      return true
    }
  }

  createCommands() {
    return {
      addIframe: this.addIframe,
    }
  }

  createInputRules(): InputRule[] {
    const rules: InputRule[] = [
      nodeInputRule({
        regexp: new RegExp('<iframe[^>]*>'),
        type: this.type,
        getAttributes: (match) => {
          return getAttrsBySignalHtmlContent(match[0])
        },
      }),
    ]

    return rules
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.inline,
        token: 'iframe_inline',
        node: this.name,
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    state.text(
      buildHtmlStringFromAst({
        tag: 'iframe',
        attrs: node.attrs,
        voidElement: true,
      }),
      false,
    )
  }
}
