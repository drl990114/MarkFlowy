import type mdast from 'mdast'
import type { Options as FromMarkdownOptions } from 'mdast-util-from-markdown'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import type { Transform } from 'prosemirror-transform'
import { isBrowser } from '../../utils/common'
import type { LineMarkName } from './inline-mark-extensions'
import type { InlineToken } from './inline-types'
gfmAutolinkLiteralFromMarkdown.transforms = []

function fixMarkNames(marks: LineMarkName[]): LineMarkName[] {
  if (marks.length <= 1) return marks
  if (marks.includes('mdMark')) return ['mdMark']
  if (marks.includes('mdCodeText')) return ['mdCodeText']
  if (marks.includes('mdText')) return marks.filter((x) => x !== 'mdText')
  return marks
}

function flatText(mdastToken: mdast.Text, depth: number): InlineToken[] {
  return [
    {
      marks: ['mdText'],
      attrs: { depth, first: true, last: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.end.offset!,
    },
  ]
}

function flatStrong(
  mdastToken: mdast.Strong,
  depth: number,
  excludedTextOffsets: readonly number[],
): InlineToken[] {
  const inlineTokens: InlineToken[] = [
    {
      marks: ['mdMark'],
      attrs: { depth, first: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 2,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(
      childMdastToken,
      depth + 1,
      excludedTextOffsets,
    )) {
      inlineToken.marks.push('mdStrong')
      inlineTokens.push(inlineToken)
    }
  }
  inlineTokens.push({
    marks: ['mdMark'],
    attrs: { depth, last: true },
    start: mdastToken.position!.end.offset! - 2,
    end: mdastToken.position!.end.offset!,
  })
  return inlineTokens
}

function flatEmphasis(
  mdastToken: mdast.Emphasis,
  depth: number,
  excludedTextOffsets: readonly number[],
): InlineToken[] {
  const inlineTokens: InlineToken[] = [
    {
      marks: ['mdMark'],
      attrs: { depth, first: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 1,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(
      childMdastToken,
      depth + 1,
      excludedTextOffsets,
    )) {
      inlineToken.marks.push('mdEm')
      inlineTokens.push(inlineToken)
    }
  }
  inlineTokens.push({
    marks: ['mdMark'],
    attrs: { depth, last: true },
    start: mdastToken.position!.end.offset! - 1,
    end: mdastToken.position!.end.offset!,
  })
  return inlineTokens
}

function flatDelete(
  mdastToken: mdast.Delete,
  depth: number,
  excludedTextOffsets: readonly number[],
): InlineToken[] {
  const inlineTokens: InlineToken[] = [
    {
      marks: ['mdMark'],
      attrs: { depth, first: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 2,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(
      childMdastToken,
      depth + 1,
      excludedTextOffsets,
    )) {
      inlineToken.marks.push('mdDel')
      inlineTokens.push(inlineToken)
    }
  }
  inlineTokens.push({
    marks: ['mdMark'],
    attrs: { depth, last: true },
    start: mdastToken.position!.end.offset! - 2,
    end: mdastToken.position!.end.offset!,
  })
  return inlineTokens
}

function flatInlineCode(mdastToken: mdast.InlineCode, depth: number): InlineToken[] {
  return [
    {
      marks: ['mdMark'],
      attrs: { depth, first: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 1,
    },
    {
      marks: ['mdCodeText'],
      attrs: { depth },
      start: mdastToken.position!.start.offset! + 1,
      end: mdastToken.position!.end.offset! - 1,
    },
    {
      marks: ['mdMark'],
      attrs: { depth, last: true },
      start: mdastToken.position!.end.offset! - 1,
      end: mdastToken.position!.end.offset!,
    },
  ]
}

// function flatImage(mdastToken: mdast.Image, depth: number): InlineToken[] {
//   return [
//     {
//       marks: ['mdImgUri'],
//       attrs: { depth, first: true, last: true, href: mdastToken.url, key: nanoid() },
//       start: mdastToken.position!.start.offset!,
//       end: mdastToken.position!.end.offset!,
//     },
//   ]
// }

function flatAutoLinkLiteral(mdastToken: mdast.Link, depth: number): InlineToken[] {
  return [
    {
      marks: ['mdLinkText'],
      attrs: { depth, first: true, last: true, href: mdastToken.url },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.end.offset!,
    },
  ]
}

function hasAtomicLinkLabel(
  mdastToken: mdast.Link | mdast.LinkReference,
  excludedTextOffsets: readonly number[],
): boolean {
  const labelContentOffset = mdastToken.position!.start.offset! + 1
  return excludedTextOffsets.includes(labelContentOffset)
}

function flatAtomicLinkLabel(
  mdastToken: mdast.Link | mdast.LinkReference,
  depth: number,
  linkHref?: string,
): InlineToken[] {
  const start = mdastToken.position!.start.offset!
  const end = mdastToken.position!.end.offset!
  const commonAttrs = { depth, ignoreWhenCopy: true, linkHref }
  const inlineTokens: InlineToken[] = [
    {
      marks: ['mdMark'],
      attrs: { ...commonAttrs, first: true },
      start,
      end: start + 1,
    },
  ]

  if (start + 1 < end) {
    inlineTokens.push({
      marks: ['mdMark'],
      attrs: { ...commonAttrs, last: start + 2 >= end },
      start: start + 1,
      end: Math.min(start + 2, end),
    })
  }
  if (start + 2 < end) {
    inlineTokens.push({
      marks: ['mdMark'],
      attrs: { ...commonAttrs, last: true },
      start: start + 2,
      end,
    })
  }

  return inlineTokens
}

function flatLink(
  mdastToken: mdast.Link,
  depth: number,
  excludedTextOffsets: readonly number[],
): InlineToken[] {
  const parentStartPos = mdastToken.position!.start.offset!
  const parentEndPos = mdastToken.position!.end.offset!

  if (mdastToken.children.length === 0) {
    if (hasAtomicLinkLabel(mdastToken, excludedTextOffsets)) {
      return flatAtomicLinkLabel(mdastToken, depth, mdastToken.url)
    }
    // process [](https://example.com)
    return [
      {
        marks: ['mdText'],
        attrs: { depth, first: true, last: false, ignoreWhenCopy: true, linkHref: mdastToken.url },
        start: mdastToken.position!.start.offset!,
        end: mdastToken.position!.start.offset! + 2,
      },
      {
        marks: ['mdText'],
        attrs: { depth, first: false, last: true, ignoreWhenCopy: true, linkHref: mdastToken.url },
        start: mdastToken.position!.start.offset! + 2,
        end: parentEndPos,
      },
    ]
  }
  const childrenStartPos = mdastToken.children[0].position!.start.offset!
  const childrenEndPos = mdastToken.children[mdastToken.children.length - 1].position!.end.offset!

  if (parentStartPos === childrenStartPos && parentEndPos === childrenEndPos) {
    return flatAutoLinkLiteral(mdastToken, depth)
  }

  const inlineTokens: InlineToken[] = [
    // match "<" for autolinks or "[" for links
    {
      marks: ['mdMark'],
      attrs: { depth, first: true, ignoreWhenCopy: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 1,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(
      childMdastToken,
      depth + 1,
      excludedTextOffsets,
    )) {
      inlineToken.marks.push('mdLinkText')
      inlineToken.attrs.href = mdastToken.url
      inlineTokens.push(inlineToken)
    }
  }

  if (childrenEndPos + 2 < parentEndPos) {
    inlineTokens.push(
      // match "](" for links
      {
        marks: ['mdMark'],
        attrs: { depth, ignoreWhenCopy: true },
        start: childrenEndPos,
        end: childrenEndPos + 2,
      },
      // match the content between "(" and ")" for links
      {
        marks: ['mdLinkUri'], // TODO: it's not only uri
        attrs: { depth, ignoreWhenCopy: true },
        start: childrenEndPos + 2,
        end: parentEndPos - 1,
      },
    )
  }

  // match ">" for autolinks or "]" for links
  inlineTokens.push({
    marks: ['mdMark'],
    attrs: { depth, last: true, ignoreWhenCopy: true },
    start: parentEndPos - 1,
    end: parentEndPos,
  })
  return inlineTokens
}

function flatLinkReference(
  mdastToken: mdast.LinkReference,
  depth: number,
  excludedTextOffsets: readonly number[],
): InlineToken[] {
  const parentEndPos = mdastToken.position!.end.offset!

  if (mdastToken.children.length === 0) {
    if (hasAtomicLinkLabel(mdastToken, excludedTextOffsets)) {
      return flatAtomicLinkLabel(mdastToken, depth)
    }
    // process [](https://example.com)
    return [
      {
        marks: ['mdText'],
        attrs: { depth, first: true, last: false, ignoreWhenCopy: true },
        start: mdastToken.position!.start.offset!,
        end: mdastToken.position!.start.offset! + 2,
      },
      {
        marks: ['mdText'],
        attrs: { depth, first: false, last: true, ignoreWhenCopy: true },
        start: mdastToken.position!.start.offset! + 2,
        end: parentEndPos,
      },
    ]
  }
  const childrenEndPos = mdastToken.children[mdastToken.children.length - 1].position!.end.offset!

  const inlineTokens: InlineToken[] = [
    // match "<" for autolinks or "[" for links
    {
      marks: ['mdMark'],
      attrs: { depth, first: true, ignoreWhenCopy: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 1,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(
      childMdastToken,
      depth + 1,
      excludedTextOffsets,
    )) {
      inlineToken.marks.push('mdLinkText')
      inlineTokens.push(inlineToken)
    }
  }

  if (childrenEndPos + 2 < parentEndPos) {
    inlineTokens.push(
      // match "](" for links
      {
        marks: ['mdMark'],
        attrs: { depth, ignoreWhenCopy: true },
        start: childrenEndPos,
        end: childrenEndPos + 2,
      },
      // match the content between "(" and ")" for links
      {
        marks: ['mdLinkUri'], // TODO: it's not only uri
        attrs: { depth, ignoreWhenCopy: true },
        start: childrenEndPos + 2,
        end: parentEndPos - 1,
      },
    )
  }

  // match ">" for autolinks or "]" for links
  inlineTokens.push({
    marks: ['mdMark'],
    attrs: { depth, last: true, ignoreWhenCopy: true },
    start: parentEndPos - 1,
    end: parentEndPos,
  })
  return inlineTokens
}
// Make a tree structural mdast `PhrasingContent` object into a flat `InlineToken` array.
function flatPhrasingContent(
  mdastToken: mdast.PhrasingContent,
  depth: number,
  excludedTextOffsets: readonly number[],
): InlineToken[] {
  switch (mdastToken.type) {
    case 'text':
      return flatText(mdastToken, depth)
    case 'strong':
      return flatStrong(mdastToken, depth, excludedTextOffsets)
    case 'emphasis':
      return flatEmphasis(mdastToken, depth, excludedTextOffsets)
    case 'delete':
      return flatDelete(mdastToken, depth, excludedTextOffsets)
    case 'inlineCode':
      return flatInlineCode(mdastToken, depth)
    case 'html':
      return []
    case 'break':
      return []
    case 'image':
      return []
    case 'imageReference':
      return []
    case 'footnote':
      return []
    case 'footnoteReference':
      return []
    case 'link':
      return flatLink(mdastToken, depth, excludedTextOffsets)
    case 'linkReference':
      return flatLinkReference(mdastToken, depth, excludedTextOffsets)
    default:
      console.warn('unknow mdast token:', mdastToken)
      return []
  }
}

type PhrasingContentType = mdast.PhrasingContent['type']

const phrasingContentTypes: Record<PhrasingContentType, true> = {
  delete: true,
  text: true,
  emphasis: true,
  strong: true,
  html: true,
  inlineCode: true,
  break: true,
  image: true,
  imageReference: true,
  footnote: true,
  footnoteReference: true,
  link: true,
  linkReference: true,
}

const fromMarkdownOptions: FromMarkdownOptions = {
  extensions: [
    {
      disable: {
        null: [
          'blockQuote',
          'characterEscape',
          'codeFenced',
          'codeIndented',
          'headingAtx',
          'htmlFlow',
          'htmlText',
          'list',
          'thematicBreak',
          'image',
        ],
      },
    },
    gfmStrikethrough({ singleTilde: false }),
    gfmAutolinkLiteral,
  ],
  mdastExtensions: [gfmStrikethroughFromMarkdown, gfmAutolinkLiteralFromMarkdown],
}

function parseInlineMarkdown(text: string): mdast.PhrasingContent[] {
  try {
    const root: mdast.Root = fromMarkdown(text, fromMarkdownOptions)
    if (root.children.length === 0) {
      return []
    }
    const paragraph = root.children[0]
    if (paragraph.type !== 'paragraph') {
      throw Error(`unknow child type ${paragraph.type}`)
    }

    for (const child of paragraph.children) {
      if (!phrasingContentTypes[child.type]) {
        throw Error(`got unknow phrasingContent token: ${JSON.stringify(child)}`)
      }
    }
    return paragraph.children
  } catch (error) {
    console.warn(`failed to parse inline markdown text ${JSON.stringify(text)}: ${error}`)
  }
  return []
}

function fixTokensMarkNames(tokens: InlineToken[]) {
  for (const inlineToken of tokens) {
    if (inlineToken.end - inlineToken.start === 0) {
      continue // Prosemirror doesn't allow empty text node
    }
    inlineToken.marks = fixMarkNames(inlineToken.marks)
  }
  return tokens
}

function parseMdInline(
  phrasingContents: mdast.PhrasingContent[],
  excludedTextOffsets: readonly number[],
  depth = 1,
) {
  let tokens: InlineToken[] = []
  for (const token of phrasingContents) {
    tokens = tokens.concat(flatPhrasingContent(token, depth, excludedTextOffsets))
  }

  return fixTokensMarkNames(tokens)
}

export function fromInlineMarkdown(
  tr: Transform,
  text: string,
  excludedTextOffsets: readonly number[] = [],
): InlineToken[] {
  const references = tr.doc.content.content.filter((node) => node.type?.name === 'reference_def')
  const refercencesText = references
    .map((refer) => {
      return `[${refer.attrs.label}]: ${refer.attrs.href}${refer.attrs.title ? ` "${refer.attrs.title}"` : ''}`
    })
    .join('\n\n')

  const phrasingContents = parseInlineMarkdown(`${text}\n\n${refercencesText}`)

  const res = parseMdInline(phrasingContents, excludedTextOffsets)

  return res
}

export type HTMLNode = {
  tag: string
  voidElement: boolean
  isClosingTag: boolean
  index: number
}

export const canCreateDomTagName = (tagName: string) => {
  if (!isBrowser()) return false
  try {
    document.createElement(tagName)
    return true
  } catch (error) {
    return false
  }
}
