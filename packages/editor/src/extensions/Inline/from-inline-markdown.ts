import type mdast from 'mdast'
import type { Options as FromMarkdownOptions } from 'mdast-util-from-markdown'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmAutolinkLiteralFromMarkdown } from 'mdast-util-gfm-autolink-literal'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { nanoid } from 'nanoid'
import voidElements from 'void-elements'
import type { LineMarkName } from './inline-mark-extensions'
import type { InlineToken } from './inline-types'
import { cloneDeep } from 'lodash'
import { getTagName, isClosingTag } from '../../utils/html'
import { needSplitInlineHtmlTokenTags } from '@/transform/markdown-it-html-inline'

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

function flatStrong(mdastToken: mdast.Strong, depth: number): InlineToken[] {
  const inlineTokens: InlineToken[] = [
    {
      marks: ['mdMark'],
      attrs: { depth, first: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 2,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(childMdastToken, depth + 1)) {
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

function flatEmphasis(mdastToken: mdast.Emphasis, depth: number): InlineToken[] {
  const inlineTokens: InlineToken[] = [
    {
      marks: ['mdMark'],
      attrs: { depth, first: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 1,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(childMdastToken, depth + 1)) {
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

function flatDelete(mdastToken: mdast.Delete, depth: number): InlineToken[] {
  const inlineTokens: InlineToken[] = [
    {
      marks: ['mdMark'],
      attrs: { depth, first: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 2,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(childMdastToken, depth + 1)) {
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

function flatImage(mdastToken: mdast.Image, depth: number): InlineToken[] {
  return [
    {
      marks: ['mdImgUri'],
      attrs: { depth, first: true, last: true, href: mdastToken.url, key: nanoid() },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.end.offset!,
    },
  ]
}

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

function flatLink(mdastToken: mdast.Link, depth: number): InlineToken[] {
  const parentStartPos = mdastToken.position!.start.offset!
  const parentEndPos = mdastToken.position!.end.offset!

  if (mdastToken.children.length === 0) {
    // process [](https://example.com)
    return [
      {
      marks: ['mdText'],
      attrs: { depth, first: true, last: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 2,
      },
      {
        marks: ['mdMark'],
        attrs: { depth },
        start: mdastToken.position!.start.offset! + 2,
        end: parentEndPos,
      }
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
      attrs: { depth, first: true },
      start: mdastToken.position!.start.offset!,
      end: mdastToken.position!.start.offset! + 1,
    },
  ]
  for (const childMdastToken of mdastToken.children) {
    for (const inlineToken of flatPhrasingContent(childMdastToken, depth + 1)) {
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
        attrs: { depth },
        start: childrenEndPos,
        end: childrenEndPos + 2,
      },
      // match the content between "(" and ")" for links
      {
        marks: ['mdLinkUri'], // TODO: it's not only uri
        attrs: { depth },
        start: childrenEndPos + 2,
        end: parentEndPos - 1,
      },
    )
  }

  // match ">" for autolinks or "]" for links
  inlineTokens.push({
    marks: ['mdMark'],
    attrs: { depth, last: true },
    start: parentEndPos - 1,
    end: parentEndPos,
  })
  return inlineTokens
}

// Make a tree structural mdast `PhrasingContent` object into a flat `InlineToken` array.
function flatPhrasingContent(mdastToken: mdast.PhrasingContent, depth: number): InlineToken[] {
  switch (mdastToken.type) {
    case 'text':
      return flatText(mdastToken, depth)
    case 'strong':
      return flatStrong(mdastToken, depth)
    case 'emphasis':
      return flatEmphasis(mdastToken, depth)
    case 'delete':
      return flatDelete(mdastToken, depth)
    case 'inlineCode':
      return flatInlineCode(mdastToken, depth)
    case 'html':
      return []
    case 'break':
      return []
    case 'image':
      return flatImage(mdastToken, depth)
    case 'imageReference':
      return []
    case 'footnote':
      return []
    case 'footnoteReference':
      return []
    case 'link':
      return flatLink(mdastToken, depth)
    case 'linkReference':
      return []
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
          'characterReference',
          'codeFenced',
          'codeIndented',
          'definition',
          'headingAtx',
          'htmlFlow',
          'list',
          'thematicBreak',
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
    if (root.children.length !== 1) {
      throw Error(`root.children has ${root.children.length} children`)
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

function parseMdInline(phrasingContents: mdast.PhrasingContent[], depth = 1) {
  const inlineTokens: InlineToken[] = []

  for (const phrasingContent of phrasingContents) {
    const tokens = flatPhrasingContent(phrasingContent, depth)
    inlineTokens.push(...fixTokensMarkNames(tokens))
  }

  return inlineTokens
}

function mergePhrasingContents(
  phrasingContents: mdast.HTML[],
  startIndex: number,
  endIndex: number,
): MdAstHtml[] {
  const merged = cloneDeep(phrasingContents[startIndex]) as MdAstHtml

  for (let i = startIndex + 1; i <= endIndex; i++) {
    merged.value += phrasingContents[i].value || ''
    merged.position!.end = phrasingContents[i].position!.end
    merged.complete = true
  }

  phrasingContents.splice(startIndex, endIndex - startIndex + 1, merged)
  return phrasingContents as MdAstHtml[]
}

function getMergeArr(phrasingContents: MdAstHtml[]) {
  const unCloseedHtmlStack: HTMLNode[] = []
  const mergeArr: HTMLNode[][] = []
  for (let i = 0; i < phrasingContents.length; i++) {
    const phrasingContent = phrasingContents[i]
    if (phrasingContent.type === 'html') {
      const tagName = getTagName(phrasingContent.value)
      const htmlNode = {
        tag: tagName,
        voidElement: !!voidElements[tagName],
        isClosingTag: isClosingTag(phrasingContent.value),
        index: i,
      }

      if (!htmlNode.voidElement) {
        if (!htmlNode.isClosingTag) {
          unCloseedHtmlStack.push(htmlNode)
        } else if (unCloseedHtmlStack[unCloseedHtmlStack.length - 1]?.tag === htmlNode.tag) {
          if (unCloseedHtmlStack.length >= 1) {
            mergeArr.push([unCloseedHtmlStack.pop()!, htmlNode])
            phrasingContent.complete = true
          }
        }
      } else {
        phrasingContent.complete = true
      }
    }
  }

  for (let i = 0; i < mergeArr.length; i++) {
    const merge = mergeArr[i]
    const startIndex = merge[0].index
    const endIndex = merge[1].index
    const parentNode = mergeArr.findIndex(
      (item) => item[0].index < startIndex && item[1].index > endIndex,
    )
    if (parentNode >= 0) {
      mergeArr.splice(i, 1)
      i--
    }
  }

  return mergeArr
}

function mergeHtmlPhrasingContents(phrasingContents: MdAstHtml[]) {
  const mergeArr = getMergeArr(phrasingContents)
  let offset = 0
  mergeArr.forEach((merge) => {
    const startIndex = merge[0].index + offset
    const endIndex = merge[1].index + offset
    mergePhrasingContents(phrasingContents, startIndex, endIndex)
    offset += startIndex - endIndex
  })
}
function flatHTMLInlineCode(phrasingContents: MdAstHtml[], depth = 1) {
  mergeHtmlPhrasingContents(phrasingContents)

  const inlineTokens: InlineToken[] = []
  phrasingContents.forEach((phrascontent) => {
    if (phrascontent.type === 'html') {
      if (phrascontent.complete) {
        inlineTokens.push({
          marks: ['mdHtmlInline'],
          attrs: {
            depth: 1,
            htmlText: phrascontent.value,
            key: nanoid(),
            first: true,
            last: true,
          },
          start: phrascontent.position!.start.offset!,
          end: phrascontent.position!.end.offset!,
        })
      } else {
        inlineTokens.push({
          marks: ['mdText'],
          attrs: { depth, first: true, last: true },
          start: phrascontent.position!.start.offset!,
          end: phrascontent.position!.end.offset!,
        })
      }
    } else {
      const tokens = flatPhrasingContent(phrascontent, depth)
      inlineTokens.push(...fixTokensMarkNames(tokens))
    }
  })

  return inlineTokens
}

function hasHtmlToken(mdastToken: mdast.PhrasingContent[]) {
  for (const token of mdastToken) {
    if (token.type === 'html' && !needSplitInlineHtmlTokenTags.includes(getTagName(token.value))) {
      return true
    }
  }
  return false
}

export function fromInlineMarkdown(text: string): InlineToken[] {
  const phrasingContents = parseInlineMarkdown(text)

  if (hasHtmlToken(phrasingContents)) {
    return flatHTMLInlineCode(phrasingContents as MdAstHtml[])
  }

  return parseMdInline(phrasingContents)
}

type MdAstHtml = {
  complete?: boolean
  value: string
} & mdast.HTML

type HTMLNode = {
  tag: string
  voidElement: boolean
  isClosingTag: boolean
  index: number
}
