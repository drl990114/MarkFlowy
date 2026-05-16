import { ClipboardReadFunction } from '@/editor/utils/clipboard-read'
import type { CommandFunction, CreateExtensionPlugin, EditorView } from '@rme-sdk/core'
import { extension, PlainExtension } from '@rme-sdk/core'
import { DOMParser, Fragment, Node, Slice } from '@rme-sdk/pm/model'
import { isBrowser } from '../../utils/common'
import { getTransformerByView } from '../Transformer/utils'

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

type ClipboardExtensionOptions = {
  imagePasteHandler?: (src: string) => Promise<string>
  clipboardReadFunction?: ClipboardReadFunction
  ignoredNodeTypes?: string[]
}

@extension<ClipboardExtensionOptions>({
  defaultOptions: { ignoredNodeTypes: [] },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class ClipboardExtension extends PlainExtension<ClipboardExtensionOptions> {
  get name() {
    return 'clipboard' as const
  }

  createPlugin(): CreateExtensionPlugin {
    return {
      props: {
        handlePaste: (view, event) => {
          const { clipboardData } = event
          if (!clipboardData) return false

          const currentNode = view.state.selection.$from.node()
          if (currentNode.type.spec.code) return false

          const text = clipboardData.getData('text/plain')
          const html = clipboardData.getData('text/html')

          this.handleClipboardData({ text, html, view })

          return true
        },
        clipboardTextSerializer: (slice, view) => {
          const schema = view.state.schema
          const transformer = getTransformerByView(view)
          const serializer = transformer.docToString
          const isText = isPureText(slice.content.toJSON())
          if (isText)
            return (slice.content as unknown as Node).textBetween(0, slice.content.size, '\n\n')

          const doc = schema.topNodeType.createAndFill(undefined, slice.content)
          if (!doc) return ''
          const value = serializer?.(doc) || ''

          return value
        },
        transformCopied: (slice) => {
          // 递归过滤节点函数
          const filterNode = (node: Node): Node[] => {
            // 检查节点的marks是否有ignoreWhenCopy=true属性
            const hasIgnoreMark = node.marks.some(
              (mark) => mark.attrs?.ignoreWhenCopy === true && node.type.name === 'text',
            )

            if (hasIgnoreMark) {
              // 如果节点有ignoreWhenCopy=true的mark，返回其子节点
              const result: Node[] = []
              if (node.content && node.content.size > 0) {
                node.content.forEach((child) => {
                  result.push(...filterNode(child))
                })
              }
              return result
            } else {
              // 如果节点没有ignoreWhenCopy=true的mark，检查是否需要过滤其子节点
              if (node.content && node.content.size > 0) {
                const filteredChildren: Node[] = []
                node.content.forEach((child) => {
                  filteredChildren.push(...filterNode(child))
                })
                // 如果子节点被过滤了，创建一个新的节点
                if (filteredChildren.length !== node.content.childCount) {
                  return [node.copy(Fragment.from(filteredChildren))]
                }
              }
              // 否则返回节点本身
              return [node]
            }
          }

          const filteredContent: Node[] = []
          // 过滤掉有ignoreWhenCopy=true属性的节点
          slice.content.forEach((node) => {
            filteredContent.push(...filterNode(node))
          })

          // 创建新的fragment和slice
          const newFragment = Fragment.from(filteredContent)
          return new Slice(newFragment, slice.openStart, slice.openEnd)
        },
      },
    }
  }

  createCommands() {
    return {
      copy: (): CommandFunction => {
        return (props) => {
          if (props.tr.selection.empty) {
            return false
          }

          if (props.dispatch && isBrowser()) {
            document.execCommand('copy')
          }

          return true
        }
      },
      paste: (): CommandFunction => {
        return (params) => {
          const { view } = params
          if (!view) return false

          if (!this.options.clipboardReadFunction) {
            return false
          }

          this.options.clipboardReadFunction().then(async (data) => {
            let { html, text } = data
            if (!html && !text) return false

            return await this.handleClipboardData({ html, text, view })
          })

          return true
        }
      },
      cut: (): CommandFunction => {
        return (props) => {
          if (props.tr.selection.empty) {
            return false
          }

          if (props.dispatch && isBrowser()) {
            document.execCommand('cut')
          }

          return true
        }
      },
    }
  }

  handleClipboardData = async ({
    html = '',
    text = '',
    view,
  }: {
    html: string
    text: string
    view: EditorView
  }) => {
    console.log('clipboard html', html)
    console.log('clipboard text', text)
    const editable = view.props.editable?.(view.state)
    if (!editable) return false

    const currentNode = view.state.selection.$from.node()
    if (currentNode.type.spec.code) return false

    if (html.length === 0 && text.length === 0) return false

    const transformer = getTransformerByView(view)

    const parser = transformer.stringToDoc
    const schema = view.state.schema
    const domParser = DOMParser.fromSchema(schema)
    let dom
    if (html.length === 0) {
      const slice = parser?.(text)

      if (!slice || typeof slice === 'string') return false

      const nodes: Node[] = []
      slice.content.forEach((node, index) => {
        if (node.type.name === 'paragraph' && index === 0) {
          node.content.forEach((child) => {
            nodes.push(child)
          })
        } else {
          nodes.push(node)
        }
      })

      this.processImagesInNodesSync(nodes, view)

      if (nodes.length === 1) {
        view.dispatch(view.state.tr.replaceSelectionWith(nodes[0], false))
      } else {
        const fragment = Fragment.from(nodes)
        view.dispatch(view.state.tr.replaceSelection(new Slice(fragment, 0, 0)))
      }

      return true
    } else {
      if (!isBrowser()) return false
      const template = document.createElement('template')
      template.innerHTML = html
      dom = template.content.cloneNode(true) as DocumentFragment

      try {
        const links = dom.querySelectorAll('a')
        links.forEach((link: HTMLAnchorElement) => {
          const href = link.getAttribute('href')
          const text = link.textContent || ''
          if (href) {
            link.textContent = `[${text}](${href})`
          }
        })
      } catch (error) {}
      template.remove()
    }

    const slice = domParser.parseSlice(dom)
    const node = isTextOnlySlice(slice)
    if (node) {
      // @ts-ignore
      node.attrs['data-rme-from-paste'] = 'true'
      view.dispatch(view.state.tr.replaceSelectionWith(node, true))

      return true
    }

    this.processImagesInSliceAsync(slice, view)
    view.dispatch(view.state.tr.replaceSelection(slice))
    return true
  }

  /**
   * Process a single image node asynchronously and update its src attribute using imagePasteHandler
   */
  private processImageNode(node: Node, view: EditorView) {
    // @ts-ignore
    node.attrs['data-rme-from-paste'] = 'true'
  }

  /**
   * Process images in a slice asynchronously and update their src attributes using imagePasteHandler
   */
  private processImagesInSliceAsync(slice: Slice, view: any) {
    const imageNodes: { node: Node; pos: number }[] = []
    let currentPos = 0

    const findImageNodes = (node: Node, pos: number) => {
      if ((node.type.name === 'html_image' || node.type.name === 'md_image') && node.attrs.src) {
        imageNodes.push({ node, pos })
      }

      if (node.content && node.content.size > 0) {
        node.content.forEach((child, offset) => {
          findImageNodes(child, pos + offset + 1)
        })
      }
    }

    slice.content.forEach((node, offset) => {
      findImageNodes(node, currentPos + offset)
    })

    imageNodes.map(({ node, pos }) => {
      if (node.attrs.src) {
        return this.processImageNode(node, view)
      }
    })
  }

  /**
   * Process images in an array of nodes asynchronously and update their src attributes using imagePasteHandler
   */
  private processImagesInNodesSync(nodes: Node[], view: any): void {
    const processNode = (node: Node) => {
      // Check if node is an image node (both image and md_image)
      if ((node.type.name === 'html_image' || node.type.name === 'md_image') && node.attrs.src) {
        this.processImageNode(node, view)
      }

      // Process child nodes recursively
      if (node.content && node.content.size > 0) {
        node.content.forEach((child) => {
          processNode(child)
        })
      }
    }

    nodes.forEach(processNode)
  }
}
