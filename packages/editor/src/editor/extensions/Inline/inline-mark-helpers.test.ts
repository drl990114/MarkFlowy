import type { MarkSpec, Node as ProseMirrorNode, NodeSpec } from '@rme-sdk/sdk/pm/model'
import { Schema } from '@rme-sdk/sdk/pm/model'
import { EditorState, NodeSelection, Plugin, TextSelection } from '@rme-sdk/sdk/pm/state'
import { DecorationSet } from '@rme-sdk/sdk/pm/view'
import { describe, expect, it } from 'vitest'

import { excludeHtmlInlineNodes } from '../../transform/markdown-it-html-inline'
import { MarkdownParser } from '../../transform/parser'
import { ParserRuleType, type ParserRule } from '../../transform/parser-type'
import { LineInlineDecorationExtension } from './inline-deco-extension'
import { initDocMarks } from './inline-mark-helpers'
import { InlineDecorateType } from './inline-types'

const markNames = [
  'mdMark',
  'mdText',
  'mdEm',
  'mdStrong',
  'mdCodeText',
  'mdCodeSpace',
  'mdDel',
  'mdLinkText',
  'mdLinkUri',
  'mdImgText',
] as const

const markAttrs = {
  class: { default: '' },
  depth: { default: 0 },
  first: { default: false },
  href: { default: '' },
  ignoreWhenCopy: { default: false },
  last: { default: false },
  linkHref: { default: null },
}

const excludedNodeSpecs = Object.fromEntries(
  excludeHtmlInlineNodes.map((name) => [
    name,
    {
      attrs:
        name === 'html_inline_node'
          ? { htmlText: { default: '' } }
          : name === 'md_image'
            ? {
                alt: { default: '' },
                'data-refer-label': { default: null },
                src: { default: '' },
              }
            : undefined,
      atom: true,
      group: 'inline',
      inline: true,
      marks: '',
    },
  ]),
) as Record<string, NodeSpec>

const nodes: Record<string, NodeSpec> = {
  doc: { content: 'block+' },
  text: { group: 'inline' },
  paragraph: { content: 'inline*', group: 'block' },
  heading: { attrs: { level: { default: 1 } }, content: 'inline*', group: 'block' },
  blockquote: { content: 'block+', group: 'block' },
  bullet_list: { content: 'list_item+', group: 'block' },
  ordered_list: {
    attrs: { order: { default: 1 } },
    content: 'list_item+',
    group: 'block',
  },
  list_item: { content: 'block+' },
  table: { content: 'table_row+', group: 'block' },
  table_row: { content: 'table_cell+' },
  table_cell: { content: 'block+' },
  code_block: {
    attrs: { inlineDecorateType: { default: InlineDecorateType.Ignore } },
    code: true,
    content: 'text*',
    group: 'block',
  },
  horizontal_rule: { atom: true, group: 'block' },
  html_block: { atom: true, group: 'block' },
  math_block: { atom: true, group: 'block' },
  mermaid_block: { atom: true, group: 'block' },
  reference_def: {
    attrs: {
      href: { default: '' },
      label: { default: '' },
      title: { default: '' },
    },
    atom: true,
    group: 'block',
  },
  ...excludedNodeSpecs,
}

const marks = Object.fromEntries(
  markNames.map((name) => [name, { attrs: markAttrs }]),
) as Record<string, MarkSpec>

const schema = new Schema({ marks, nodes })
const parserRules: ParserRule[] = [
  {
    hasOpenClose: true,
    node: 'paragraph',
    token: 'paragraph',
    type: ParserRuleType.block,
  },
  { getText: (token) => token.content, token: 'text', type: ParserRuleType.text },
  { getText: (token) => token.content, token: 'inline', type: ParserRuleType.text },
  { getText: () => '\n', token: 'softbreak', type: ParserRuleType.text },
  ...excludeHtmlInlineNodes.map(
    (token): ParserRule => ({ token, type: ParserRuleType.inline }),
  ),
]

type InlineNodeSegment = { nodeName: string }
type InlineSegment = InlineNodeSegment | string
type ReferenceDefinition = { href: string; label: string; title?: string }

function inlineNode(nodeName = 'html_inline_node'): InlineNodeSegment {
  return { nodeName }
}

function createReferenceNode(reference: ReferenceDefinition): ProseMirrorNode {
  return schema.node('reference_def', {
    href: reference.href,
    label: reference.label,
    title: reference.title ?? '',
  })
}

function createParagraph(segments: InlineSegment[]): ProseMirrorNode {
  return schema.node(
    'paragraph',
    null,
    segments.flatMap((segment) => {
      if (typeof segment === 'string') {
        return segment ? [schema.text(segment)] : []
      }
      return [schema.node(segment.nodeName)]
    }),
  )
}

function markInlineSegments(
  segments: InlineSegment[],
  references: ReferenceDefinition[] = [],
): ProseMirrorNode {
  const doc = schema.node('doc', null, [
    createParagraph(segments),
    ...references.map(createReferenceNode),
  ])
  return initDocMarks(doc)
}

function parseWithMarks(markdown: string): ProseMirrorNode {
  return initDocMarks(new MarkdownParser(schema, parserRules).parse(markdown))
}

function parseWithMarksAndReferences(
  markdown: string,
  references: ReferenceDefinition[],
): ProseMirrorNode {
  const parsedDoc = new MarkdownParser(schema, parserRules).parse(markdown)
  return initDocMarks(
    schema.node('doc', null, [
      ...parsedDoc.content.content,
      ...references.map(createReferenceNode),
    ]),
  )
}

function collectMarkNames(doc: ProseMirrorNode): Set<string> {
  const names = new Set<string>()
  doc.descendants((node) => {
    for (const mark of node.marks) names.add(mark.type.name)
  })
  return names
}

function findNodes(doc: ProseMirrorNode, nodeName: string): ProseMirrorNode[] {
  const foundNodes: ProseMirrorNode[] = []
  doc.descendants((node) => {
    if (node.type.name === nodeName) foundNodes.push(node)
  })
  return foundNodes
}

const inlineSyntaxCases = [
  { expectedMarks: ['mdText'], markdown: 'plain text', name: 'plain text' },
  { expectedMarks: ['mdText'], markdown: '中文与 emoji 🚀', name: 'Unicode text' },
  { expectedMarks: ['mdEm'], markdown: '*emphasis*', name: 'asterisk emphasis' },
  { expectedMarks: ['mdEm'], markdown: '_emphasis_', name: 'underscore emphasis' },
  { expectedMarks: ['mdStrong'], markdown: '**strong**', name: 'asterisk strong' },
  { expectedMarks: ['mdStrong'], markdown: '__strong__', name: 'underscore strong' },
  { expectedMarks: ['mdDel'], markdown: '~~deleted~~', name: 'strikethrough' },
  { expectedMarks: ['mdCodeText'], markdown: '`code`', name: 'inline code' },
  {
    expectedMarks: ['mdCodeText'],
    markdown: '``code with ` backtick``',
    name: 'multi-backtick inline code',
  },
  {
    expectedMarks: ['mdCodeText'],
    markdown: '` code with padding `',
    name: 'space-padded inline code',
  },
  {
    expectedMarks: ['mdLinkText', 'mdLinkUri'],
    markdown: '[link](https://example.com)',
    name: 'inline link',
  },
  {
    expectedMarks: ['mdLinkText', 'mdLinkUri'],
    markdown: '[link](https://example.com "title")',
    name: 'link with title',
  },
  { expectedMarks: ['mdText'], markdown: '[](https://example.com)', name: 'empty link label' },
  {
    expectedMarks: ['mdLinkText'],
    markdown: 'https://example.com/path?q=1',
    name: 'GFM URL autolink',
  },
  { expectedMarks: ['mdLinkText'], markdown: 'user@example.com', name: 'GFM email autolink' },
  {
    expectedMarks: ['mdLinkText'],
    markdown: '<https://example.com>',
    name: 'angle-bracket autolink',
  },
  {
    expectedMarks: ['mdLinkText'],
    markdown: '<user@example.com>',
    name: 'angle-bracket email autolink',
  },
  {
    expectedMarks: ['mdLinkText', 'mdLinkUri'],
    markdown: '[parentheses](https://example.com/a_(b))',
    name: 'link destination with parentheses',
  },
  {
    expectedMarks: ['mdEm', 'mdStrong'],
    markdown: '***strong emphasis***',
    name: 'strong emphasis',
  },
  {
    expectedMarks: ['mdEm', 'mdStrong'],
    markdown: '**strong *nested emphasis***',
    name: 'nested emphasis in strong',
  },
  {
    expectedMarks: ['mdDel', 'mdStrong'],
    markdown: '~~**deleted strong**~~',
    name: 'strong in strikethrough',
  },
  {
    expectedMarks: ['mdLinkText', 'mdStrong'],
    markdown: '[**strong link**](https://example.com)',
    name: 'strong link label',
  },
  {
    expectedMarks: ['mdEm', 'mdLinkText'],
    markdown: '*[emphasis link](https://example.com)*',
    name: 'link in emphasis',
  },
  {
    expectedMarks: ['mdCodeText'],
    markdown: '**`code wins over strong`**',
    name: 'code nested in strong',
  },
  { expectedMarks: ['mdText'], markdown: 'line  \nbreak', name: 'hard line break source' },
  { expectedMarks: ['mdText'], markdown: 'line\nbreak', name: 'soft line break source' },
  { expectedMarks: ['mdText'], markdown: 'AT&amp;T', name: 'character entity source' },
  { expectedMarks: ['mdText'], markdown: '\\*escaped punctuation\\*', name: 'escaped punctuation' },
] as const

const spanningAtomSyntaxCases = [
  {
    expectedMarks: ['mdEm'],
    name: 'emphasis',
    segments: ['*em', inlineNode(), 'phasis*'],
  },
  {
    expectedMarks: ['mdStrong'],
    name: 'strong',
    segments: ['**str', inlineNode(), 'ong**'],
  },
  {
    expectedMarks: ['mdDel'],
    name: 'strikethrough',
    segments: ['~~del', inlineNode(), 'eted~~'],
  },
  {
    expectedMarks: ['mdCodeText'],
    name: 'inline code',
    segments: ['`co', inlineNode(), 'de`'],
  },
  {
    expectedMarks: ['mdLinkText', 'mdLinkUri'],
    name: 'inline link label',
    segments: ['[li', inlineNode(), 'nk](https://example.com)'],
  },
  {
    expectedMarks: ['mdLinkText', 'mdLinkUri'],
    name: 'inline link destination',
    segments: ['[link](https://exa', inlineNode(), 'mple.com)'],
  },
  {
    expectedMarks: ['mdLinkText'],
    name: 'GFM URL autolink',
    segments: ['https://exa', inlineNode(), 'mple.com'],
  },
  {
    expectedMarks: ['mdLinkText'],
    name: 'GFM email autolink',
    segments: ['user@exa', inlineNode(), 'mple.com'],
  },
  {
    expectedMarks: ['mdLinkText'],
    name: 'angle-bracket autolink',
    segments: ['<https://exa', inlineNode(), 'mple.com>'],
  },
  {
    expectedMarks: ['mdEm', 'mdStrong'],
    name: 'nested strong emphasis',
    segments: ['***nes', inlineNode(), 'ted***'],
  },
  {
    expectedMarks: ['mdStrong'],
    name: 'multiple adjacent inline atoms',
    segments: ['**left', inlineNode(), inlineNode(), 'right**'],
  },
] satisfies readonly {
  expectedMarks: readonly string[]
  name: string
  segments: InlineSegment[]
}[]

const reference = { href: 'https://example.com/reference', label: 'ref', title: 'Reference' }
const referenceSyntaxCases = [
  { markdown: '[label][ref]', name: 'full reference link' },
  { markdown: '[ref][]', name: 'collapsed reference link' },
  { markdown: '[ref]', name: 'shortcut reference link' },
] as const

const excludedSyntaxCases = [
  { markdown: '<span>', name: 'inline HTML', nodeName: 'html_inline_node' },
  { markdown: '<img src="image.png">', name: 'HTML image', nodeName: 'md_image' },
  { markdown: '<iframe src="page.html" />', name: 'inline iframe', nodeName: 'iframe_inline' },
  { markdown: '<br>', name: 'HTML break', nodeName: 'html_br' },
  { markdown: '$E = mc^2$', name: 'inline math', nodeName: 'math_inline' },
  { markdown: '![alt](image.png)', name: 'Markdown image', nodeName: 'md_image' },
] as const

describe('initDocMarks', () => {
  describe('supported inline Markdown syntax', () => {
    it.each(inlineSyntaxCases)('recognizes $name', ({ expectedMarks, markdown }) => {
      const actualMarkNames = collectMarkNames(markInlineSegments([markdown]))

      for (const expectedMark of expectedMarks) expect(actualMarkNames).toContain(expectedMark)
    })

    it.each(inlineSyntaxCases)(
      'keeps $name sorted on either side of an inline atom',
      ({ markdown }) => {
        expect(() => markInlineSegments([markdown, inlineNode(), 'tail'])).not.toThrow()
        expect(() => markInlineSegments(['head', inlineNode(), markdown])).not.toThrow()
      },
    )

    it.each(referenceSyntaxCases)('supports $name around an inline atom', ({ markdown }) => {
      const before = markInlineSegments([markdown, inlineNode(), '`tail`'], [reference])
      const after = markInlineSegments(['`head`', inlineNode(), markdown], [reference])

      expect(collectMarkNames(before)).toContain('mdLinkText')
      expect(collectMarkNames(after)).toContain('mdLinkText')
    })

    it.each(spanningAtomSyntaxCases)(
      'splits $name marks around atoms inside the source range',
      ({ expectedMarks, segments }) => {
        const doc = markInlineSegments(segments)
        const actualMarkNames = collectMarkNames(doc)

        for (const expectedMark of expectedMarks) {
          expect(actualMarkNames).toContain(expectedMark)
        }
        for (const node of findNodes(doc, 'html_inline_node')) expect(node.marks).toHaveLength(0)
      },
    )

    it.each(referenceSyntaxCases)('splits $name labels around an inline atom', ({ markdown }) => {
      const splitAt = Math.max(1, markdown.indexOf(']') - 1)
      const doc = markInlineSegments(
        [markdown.slice(0, splitAt), inlineNode(), markdown.slice(splitAt)],
        [reference],
      )

      expect(collectMarkNames(doc)).toContain('mdLinkText')
      expect(findNodes(doc, 'html_inline_node')[0].marks).toHaveLength(0)
    })
  })

  describe('excluded inline node syntax', () => {
    it.each(excludedSyntaxCases)(
      'parses $name between adjacent Markdown tokens',
      ({ markdown, nodeName }) => {
        const doc = parseWithMarks(`*mark*${markdown}\`qwe\``)

        expect(findNodes(doc, nodeName)).toHaveLength(1)
      },
    )

    it.each(excludedSyntaxCases)(
      'keeps $name unmarked inside an emphasis source range',
      ({ markdown, nodeName }) => {
        const doc = parseWithMarks(`*before${markdown}after*`)

        expect(collectMarkNames(doc)).toContain('mdEm')
        for (const node of findNodes(doc, nodeName)) expect(node.marks).toHaveLength(0)
      },
    )

    it.each(excludedSyntaxCases)('maps $name at every token boundary', ({ nodeName }) => {
      const placements: InlineSegment[][] = [
        [inlineNode(nodeName), '*mark*'],
        ['*mark*', inlineNode(nodeName)],
        ['*mark*', inlineNode(nodeName), '`qwe`'],
        ['plain', inlineNode(nodeName), 'plain'],
        ['*mark*', inlineNode(nodeName), inlineNode(nodeName), '`qwe`'],
      ]

      for (const segments of placements) {
        const doc = markInlineSegments(segments)
        const excludedNodes = findNodes(doc, nodeName)

        expect(excludedNodes.length).toBeGreaterThan(0)
        for (const node of excludedNodes) expect(node.marks).toHaveLength(0)
      }
    })
  })

  describe('image-only link labels', () => {
    const badgeUrl =
      'https://img.shields.io/github/v/release/drl990114/MarkFlowy?color=%239accfe&label=version&style=flat-square'
    const releaseReference = { ...reference, label: 'release' }

    it.each([
      {
        markdown: `[![App Version](${badgeUrl})][release] plain`,
        name: 'full reference link',
        references: [releaseReference],
      },
      {
        markdown: `[![App Version](${badgeUrl})](https://github.com/drl990114/MarkFlowy) plain`,
        name: 'inline link',
        references: [],
      },
    ])('shows only the image for an image-only $name', ({ markdown, references }) => {
      const doc = parseWithMarksAndReferences(markdown, references)
      const image = findNodes(doc, 'md_image')[0]
      const textNodes: ProseMirrorNode[] = []

      doc.descendants((node) => {
        if (node.isText) textNodes.push(node)
      })

      const expectedSource = references.length
        ? '[][release]'
        : '[](https://github.com/drl990114/MarkFlowy)'
      const hiddenSource = textNodes
        .filter((node) => node.marks.some((mark) => mark.type.name === 'mdMark'))
        .map((node) => node.text)
        .join('')
      const visibleText = textNodes
        .filter((node) => node.marks.every((mark) => mark.type.name !== 'mdMark'))
        .map((node) => node.text)
        .join('')

      expect(image.attrs.src).toBe(badgeUrl)
      expect(image.marks).toHaveLength(0)
      expect(hiddenSource).toBe(expectedSource)
      expect(visibleText).toBe(' plain')
    })

    it('reveals the complete reference source when the cursor enters it', () => {
      const doc = parseWithMarksAndReferences(
        `[![App Version](${badgeUrl})][release] plain`,
        [releaseReference],
      )
      const hiddenSourceRanges: [number, number][] = []
      let cursorPos = -1

      doc.descendants((node, pos) => {
        if (!node.isText) return
        if (node.text?.includes('release')) cursorPos = pos + 2
        if (node.marks.some((mark) => mark.type.name === 'mdMark')) {
          hiddenSourceRanges.push([pos, pos + node.nodeSize])
        }
      })

      const state = EditorState.create({
        doc,
        selection: TextSelection.create(doc, cursorPos),
      })
      const plugin = new Plugin(new LineInlineDecorationExtension().createPlugin())
      const decorationSource = plugin.props.decorations?.call(plugin, state)

      expect(decorationSource).toBeInstanceOf(DecorationSet)
      const decorations = decorationSource as DecorationSet
      expect(decorations.find().map(({ from, to }) => [from, to])).toEqual(
        hiddenSourceRanges,
      )
    })

    it('reveals the complete reference source when the image is selected', () => {
      const doc = parseWithMarksAndReferences(
        `[![App Version](${badgeUrl})][release] plain`,
        [releaseReference],
      )
      const hiddenSourceRanges: [number, number][] = []
      let imagePos = -1

      doc.descendants((node, pos) => {
        if (node.type.name === 'md_image') imagePos = pos
        if (node.isText && node.marks.some((mark) => mark.type.name === 'mdMark')) {
          hiddenSourceRanges.push([pos, pos + node.nodeSize])
        }
      })

      const state = EditorState.create({
        doc,
        selection: NodeSelection.create(doc, imagePos),
      })
      const plugin = new Plugin(new LineInlineDecorationExtension().createPlugin())
      const decorationSource = plugin.props.decorations?.call(plugin, state)

      expect(decorationSource).toBeInstanceOf(DecorationSet)
      const decorations = decorationSource as DecorationSet
      expect(decorations.find().map(({ from, to }) => [from, to])).toEqual(
        hiddenSourceRanges,
      )
    })
  })

  describe('text-bearing block Markdown structures', () => {
    it('leaves empty text blocks and atom-only text blocks unchanged', () => {
      const emptyParagraph = schema.node('paragraph')
      const atomOnlyParagraph = schema.node('paragraph', null, [
        schema.node('html_inline_node'),
        schema.node('md_image'),
      ])

      expect(() => initDocMarks(schema.node('doc', null, [emptyParagraph]))).not.toThrow()
      const atomOnlyDoc = initDocMarks(schema.node('doc', null, [atomOnlyParagraph]))
      expect(findNodes(atomOnlyDoc, 'html_inline_node')[0].marks).toHaveLength(0)
      expect(findNodes(atomOnlyDoc, 'md_image')[0].marks).toHaveLength(0)
    })

    it('keeps absolute chunks sorted across headings, paragraphs, quotes, lists, and tables', () => {
      const inlineContent = () => [
        schema.text('**strong**'),
        schema.node('html_inline_node'),
        schema.text('`code`'),
      ]
      const paragraph = () => schema.node('paragraph', null, inlineContent())
      const listItem = () => schema.node('list_item', null, [paragraph()])
      const tableCell = () => schema.node('table_cell', null, [paragraph()])
      const codeBlock = schema.node(
        'code_block',
        { inlineDecorateType: InlineDecorateType.Ignore },
        schema.text('**literal code**'),
      )
      const doc = schema.node('doc', null, [
        schema.node('heading', { level: 2 }, inlineContent()),
        paragraph(),
        schema.node('blockquote', null, [paragraph()]),
        schema.node('bullet_list', null, [listItem(), listItem()]),
        schema.node('ordered_list', { order: 1 }, [listItem(), listItem()]),
        schema.node('horizontal_rule'),
        codeBlock,
        schema.node('html_block'),
        schema.node('math_block'),
        schema.node('mermaid_block'),
        schema.node('table', null, [
          schema.node('table_row', null, [tableCell(), tableCell()]),
          schema.node('table_row', null, [tableCell(), tableCell()]),
        ]),
      ])

      const markedDoc = initDocMarks(doc)

      const actualMarkNames = collectMarkNames(markedDoc)
      expect(actualMarkNames).toContain('mdStrong')
      expect(actualMarkNames).toContain('mdCodeText')
      expect(findNodes(markedDoc, 'html_inline_node')).toHaveLength(11)
      expect(findNodes(markedDoc, 'code_block')[0].firstChild?.marks).toHaveLength(0)
    })
  })
})
