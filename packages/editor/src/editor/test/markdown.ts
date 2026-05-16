import {
  type AnyExtension,
  type Fragment,
  htmlToProsemirrorNode,
  isProsemirrorNode,
  type ProsemirrorNode,
} from '@rme-sdk/core'
import dedent from 'dedent'
import type {
  RemirrorTestChain,
  TaggedContentWithText,
  TaggedProsemirrorNode,
} from 'jest-remirror'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

function createProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
}

let processor: ReturnType<typeof createProcessor> | null = null

function markdownToHtml(markdown: string): string {
  if (!processor) {
    processor = createProcessor()
  }
  return String(processor.processSync(markdown))
}

function textNodeToTaggedTextNode(
  t: RemirrorTestChain<AnyExtension>,
  node: ProsemirrorNode,
): TaggedContentWithText {
  let tagged: TaggedContentWithText = node.text!
  if (node.marks?.length) {
    for (const mark of node.marks) {
      const withMark = t.attributeMarks[mark.type.name](mark.attrs)(tagged)
      if (withMark.length !== 1) {
        throw new Error('Unexpected length')
      }
      tagged = withMark[0]
    }
  }
  return tagged
}

function fragmentToArray(fragment: Fragment) {
  const content = []
  for (let i = 0; i < fragment.childCount; i++) {
    content.push(fragment.child(i))
  }
  return content
}

function nodeToTaggedNode(
  t: RemirrorTestChain<AnyExtension>,
  node: ProsemirrorNode,
): TaggedContentWithText {
  if (node.isText) {
    return textNodeToTaggedTextNode(t, node)
  }
  const content = fragmentToArray(node.content).map((node) =>
    nodeToTaggedNode(t, node),
  )
  return t.attributeNodes[node.type.name](node.attrs)(...content)
}

function docToTaggedDoc(
  t: RemirrorTestChain<AnyExtension>,
  doc: ProsemirrorNode,
): TaggedProsemirrorNode {
  const taggedDoc = nodeToTaggedNode(t, doc)
  if (!isProsemirrorNode(taggedDoc)) {
    throw new Error('Unexpected tagged doc type')
  }
  return taggedDoc
}

export function markdownToTaggedDoc(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Unable to pass the type check without using any
  t: RemirrorTestChain<any>,
  markdown: string,
): TaggedProsemirrorNode {
  markdown = tags.reduce(
    (str, tag) => str.replaceAll(`<${tag}>`, `\\<${tag}\\>`),
    dedent(markdown),
  )
  const html = markdownToHtml(markdown)
  const doc = htmlToProsemirrorNode({ content: html, schema: t.schema })
  return docToTaggedDoc(t as RemirrorTestChain<AnyExtension>, doc)
}

const tags = ['cursor', 'node', 'start', 'end', 'anchor', 'all', 'gap'] as const
