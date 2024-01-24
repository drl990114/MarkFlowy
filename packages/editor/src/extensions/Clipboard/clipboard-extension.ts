import { wysiwygTransformer } from '@/components/WysiwygEditor'
import type { CreateExtensionPlugin } from '@remirror/core'
import { PlainExtension } from '@remirror/core'
import type { Slice, Node } from '@remirror/pm/model'
import { DOMSerializer, DOMParser } from '@remirror/pm/model'

type UnknownRecord = Record<string, unknown>
function isPureText(content: UnknownRecord | UnknownRecord[] | undefined | null): boolean {
  if (!content) return false
  if (Array.isArray(content)) {
    if (content.length > 1) return false
    return isPureText(content[0])
  }

  const child = content.content
  if (child) return isPureText(child as UnknownRecord[])

  return content.type === 'text'
}

function isTextOnlySlice(slice: Slice): Node | false {
  if (slice.content.childCount === 1) {
    const node = slice.content.firstChild
    if (node?.type.name === 'text' && node.marks.length === 0) return node

    if (node?.type.name === 'paragraph' && node.childCount === 1) {
      const _node = node.firstChild
      if (_node?.type.name === 'text' && _node.marks.length === 0) return _node
    }
  }

  return false
}

export class ClipboardExtension extends PlainExtension {
  get name() {
    return 'clipboard' as const
  }

  createPlugin(): CreateExtensionPlugin {
    return {
      props: {
        handlePaste: (view, event) => {
          const parser = wysiwygTransformer.stringToDoc
          const schema = view.state.schema
          const editable = view.props.editable?.(view.state)
          const { clipboardData } = event
          if (!editable || !clipboardData) return false

          const currentNode = view.state.selection.$from.node()
          if (currentNode.type.spec.code) return false

          const text = clipboardData.getData('text/plain')

          const html = clipboardData.getData('text/html')
          if (html.length === 0 && text.length === 0) return false

          const domParser = DOMParser.fromSchema(schema)
          let dom
          if (html.length === 0) {
            const slice = parser?.(text)
            if (!slice || typeof slice === 'string') return false

            dom = DOMSerializer.fromSchema(schema).serializeFragment(slice.content)
          } else {
            const template = document.createElement('template')
            template.innerHTML = html
            dom = template.content.cloneNode(true)
            template.remove()
          }

          const slice = domParser.parseSlice(dom)
          const node = isTextOnlySlice(slice)
          if (node) {
            view.dispatch(view.state.tr.replaceSelectionWith(node, true))
            return true
          }

          view.dispatch(view.state.tr.replaceSelection(slice))
          return true
        },
        clipboardTextSerializer: (slice, view) => {
          const schema = view.state.schema
          const serializer = wysiwygTransformer.docToString
          const isText = isPureText(slice.content.toJSON())
          if (isText)
            return (slice.content as unknown as Node).textBetween(0, slice.content.size, '\n\n')

          const doc = schema.topNodeType.createAndFill(undefined, slice.content)
          if (!doc) return ''
          const value = serializer?.(doc) || ''
          return value
        },
      },
    }
  }
}
