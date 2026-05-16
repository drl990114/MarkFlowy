import { prosemirrorNodeToHtml } from '@rme-sdk/main'
import { type Node } from '@rme-sdk/pm/model'
// @ts-ignore
import HTML from 'html-parse-stringify'
import { normalizeReference } from 'markdown-it/lib/common/utils.mjs'
import mermaid from 'mermaid'
import { nanoid } from 'nanoid'
import { EditorProps } from '../components'
import { HTMLAstNode } from '../components/Preview'
import { isBrowser } from './common'

export const handlerByAdditions: Record<
  string,
  {
    checker: (node: HTMLAstNode, delegateOptions: EditorProps['delegateOptions'], referenceDefs?: Map<string, { href: string; title: string }>) => boolean
    handler: (node: HTMLAstNode, delegateOptions: EditorProps['delegateOptions'], referenceDefs?: Map<string, { href: string; title: string }>) => Promise<void>
  }[]
> = {
  img: [
    {
      checker: (node: HTMLAstNode, delegateOptions: EditorProps['delegateOptions']) => {
        return node.name === 'img' && node.attrs?.src && delegateOptions?.handleViewImgSrcUrl
      },
      handler: async (node: HTMLAstNode, delegateOptions: EditorProps['delegateOptions']) => {
        node.attrs.src = await delegateOptions?.handleViewImgSrcUrl?.(node.attrs.src)
        node.attrs.key = nanoid()
      },
    },
    {
      checker: (node: HTMLAstNode) => {
        return node.name === 'img' && node.attrs?.['data-refer-label']
      },
      handler: async (node: HTMLAstNode, delegateOptions: EditorProps['delegateOptions'], referenceDefs) => {
        const label = node.attrs['data-refer-label']
        const def = referenceDefs?.get(normalizeReference(label))
        if (def?.href) {
          node.attrs.src = def.href
          if (def.title) {
            node.attrs.title = def.title
          }
        }
        if (delegateOptions?.handleViewImgSrcUrl && node.attrs.src) {
          node.attrs.src = await delegateOptions.handleViewImgSrcUrl(node.attrs.src)
        }
        node.attrs.key = nanoid()
        delete node.attrs['data-refer-label']
      },
    },
  ],
  pre: [
    {
      checker: (node: HTMLAstNode) => {
        return node.attrs['data-type'] === 'mermaid'
      },
      handler: async (node: HTMLAstNode, delegateOptions: EditorProps['delegateOptions']) => {
        let textContent = node.children?.[0]?.content || ''

        if (isBrowser()) {
          const dom = document.createElement('div')
          dom.innerHTML = textContent
          textContent = dom.textContent || ''
        }

        const res = await mermaid.render(
          `mermaid_${previewMermaidRenderCount.count++}`,
          textContent,
        )
        const svgAst = HTML.parse(res.svg)

        node.name = 'div'
        node.attrs = {
          key: nanoid(),
        }
        node.children = svgAst
      },
    },
  ],
}

const previewMermaidRenderCount = { count: 0 }

export const rmeProsemirrorNodeToHtml = async (
  doc: Node,
  delegateOptions: EditorProps['delegateOptions'],
) => {
  const html = prosemirrorNodeToHtml(doc)
  const fullAst = HTML.parse(html)
  const referenceDefs = new Map<string, { href: string; title: string }>()
  for (const child of doc.content.content) {
    if (child.type.name === 'reference_def') {
      let label = ''
      let href = ''
      let title = ''
      for (const contentNode of child.content.content) {
        if (contentNode.type.name === 'reference_label') {
          label = contentNode.textContent || ''
        } else if (contentNode.type.name === 'reference_href') {
          href = contentNode.textContent || ''
        } else if (contentNode.type.name === 'reference_title') {
          title = contentNode.textContent || ''
        }
      }
      if (label && href) {
        referenceDefs.set(normalizeReference(label), { href, title })
      }
    }
  }
  console.log('preview', referenceDefs, fullAst)

  const imageLoadTasks: Promise<void>[] = []
  const handleHtmlText = (ast: HTMLAstNode[]) => {
    const handleNode = (node: HTMLAstNode) => {
      if (!node) {
        return
      }
      const handlerByAddition = handlerByAdditions[node.name]

      if (handlerByAddition) {
        for (const handler of handlerByAddition) {
          if (handler.checker(node, delegateOptions, referenceDefs)) {
            imageLoadTasks.push(handler.handler(node, delegateOptions, referenceDefs))
          }
        }
      }

      if (node.children) {
        handleHtmlText(node.children)
      }
    }

    for (let i = 0; i < ast.length; i++) {
      handleNode(ast[i])
    }
  }

  handleHtmlText(fullAst)

  try {
    await Promise.all(imageLoadTasks)
    return HTML.stringify(fullAst) as string
  } catch (error) {
    return html
  }
}
