import {
  // BoldExtension,
  // BulletListExtension,
  // CodeBlockExtension,
  DropCursorExtension,
} from '@rme-sdk/sdk/extensions'
import { LineTableCellExtension, LineTableHeaderCellExtension } from './Table/table-extension'
// import data from 'svgmoji/emoji.json'
import { CountExtension } from '@rme-sdk/sdk/extensions/count'
import { corePreset } from '@rme-sdk/sdk/presets/core'
import { ReactComponentExtension } from '@rme-sdk/sdk/react'
import { type ClipboardReadFunction, clipboardRead } from '../utils/clipboard-read'
import { isBrowser } from '../utils/common'
import type { CurrentDateFormatOption } from '../utils/date'
import { AIExtension } from './Ai'
import type { AIOptions } from './Ai/ai-types'
import { LineBlockquoteExtension } from './BlockQuote'
import { ClipboardExtension } from './Clipboard'
import { LineCodeMirrorExtension } from './CodeMirror/codemirror-extension'
import type { CustomCopyFunction } from './CodeMirror/codemirror-types'
import { type CodemirrorOptions, getSetupByCodemirrorOptions } from './CodeMirror/setup'
import { CommonKeymapExtension } from './CommonKeymap'
import { CopilotExtension } from './Copilot/copilot-extension'
import { DateExtension } from './Date'
import { FindExtension } from './Find/find-extension'
import { HandleInputExtension } from './HandleInput/handle-input-extension'
import { LineHardBreakExtension } from './HardBreak'
import { LineHeadingExtension } from './Heading'
import { LineHorizontalRuleExtension } from './HorizontalRule'
import { HtmlBrExtension } from './HtmlBr/br-extension'
import { LineHtmlBlockExtension } from './HtmlNode/html-block-extension'
import { HtmlInlineNodeExtension } from './HtmlNode/html-inline-node'
import { IframeExtension } from './Iframe'
import { HtmlImageExtension } from './Image'
import {
  type DelayedImage,
  type FileWithProgress,
  MdImgUriExtension,
} from './Image/md-image-extension'
import { LineInlineDecorationExtension, LineInlineMarkExtension, markExtensions } from './Inline'
import { LineListExtension } from './List'
import { MathBlockExtension, MathInlineExtension } from './Math'
import { MermaidBlockExtension } from './Mermaid'
import { NodeIndicatorExtension } from './NodeIndicator'
import { LineParagraphExtension } from './Paragraph'
import { PlaceholderExtension, type PlaceholderOptions } from './Placeholder'
import {
  ReferenceDefinitionExtension,
  ReferenceHrefExtension,
  ReferenceLabelExtension,
  ReferenceTitleExtension,
} from './Reference'
import { SlashMenuExtension } from './SlashMenu'
import { LineTableExtension, LineTableRowExtension } from './Table'
import { LineTextExtension } from './Text'
import { TransformerExtension } from './Transformer/transformer-extension'
import { TypewriterScrollExtension, type TypewriterScrollOptions } from './TypewriterScroll'
import { LinkClickExtension, type LinkClickHandler } from './LinkClick'
import {
  LivePreviewBlockExtension,
  type LivePreviewBlockBehavior,
} from './LivePreviewBlock'

export * from './Image'
export * from './List'
export type { LivePreviewBlockBehavior } from './LivePreviewBlock'

export type ImageInsertAttributes = {
  src: string
  alt?: string
  title?: string
  'data-file-name'?: string
}

export type ExtensionsOptions = {
  disableAllBuildInShortcuts?: boolean

  handleViewImgSrcUrl?: (src: string) => Promise<string>

  imageHostingHandler?: (src: string) => Promise<string>

  imagePasteHandler?: (src: string) => Promise<string>

  imageInsertHandler?: () => Promise<ImageInsertAttributes | null>

  ai?: AIOptions

  customCopyFunction?: CustomCopyFunction

  overrideShortcutMap?: Record<string, string>

  clipboardReadFunction?: ClipboardReadFunction

  codemirrorOptions?: CodemirrorOptions

  livePreviewBlock?: {
    behavior?: LivePreviewBlockBehavior
  }

  uploadImageHandler?: (files: FileWithProgress[]) => DelayedImage[]

  typewriterScroll?: TypewriterScrollOptions

  placeholder?: PlaceholderOptions

  handleLinkClick?: LinkClickHandler

  currentDateFormat?: CurrentDateFormatOption
}

function extensions(options: ExtensionsOptions): any[] {
  const defaultCopyFunction = (code: string) => {
    if (isBrowser() && navigator.clipboard) {
      navigator.clipboard.writeText(code)
    }
    return true
  }
  const {
    handleViewImgSrcUrl,
    imageHostingHandler,
    imagePasteHandler,
    customCopyFunction = defaultCopyFunction,
    clipboardReadFunction = clipboardRead,
    codemirrorOptions = {},
    typewriterScroll: typewriterScrollOptions = {},
    placeholder: placeholderOptions = {},
  } = options

  const typewriterScrollExtension = new TypewriterScrollExtension(typewriterScrollOptions)
  const typewriterCmExtension = [typewriterScrollExtension.createCodeMirrorExtension()]

  const codemirrorNodeCommonOptions = {
    customCopyFunction,
    behavior: options.livePreviewBlock?.behavior,
    codemirrorExtensions: [
      ...getSetupByCodemirrorOptions({
        ...codemirrorOptions,
        lineNumbers: true,
      }),
      ...typewriterCmExtension,
    ],
  }

  const res: any[] = [
    ...corePreset({ excludeExtensions: ['paragraph', 'text'] }),
    ...markExtensions({
      handleViewImgSrcUrl,
    }),
    new CommonKeymapExtension(),
    new DateExtension({
      currentDateFormat: options.currentDateFormat,
    }),
    new LinkClickExtension({
      handleLinkClick: options.handleLinkClick,
    }),
    new CountExtension({}),
    new HtmlImageExtension({
      handleViewImgSrcUrl,
      imageHostingHandler,
      imagePasteHandler,
    }),
    new MdImgUriExtension({
      handleViewImgSrcUrl,
      imageHostingHandler,
      imagePasteHandler,
      imageInsertHandler: options.imageInsertHandler ?? (async () => null),
      uploadHandler: options.uploadImageHandler,
    }),
    new HandleInputExtension(),
    new HtmlBrExtension(),
    new IframeExtension({
      enableResizing: true,
    }),
    // new LineHtmlInlineExtension({
    //   handleViewImgSrcUrl,
    // }),

    new PlaceholderExtension({ placeholder: "Type '/' for commands", ...placeholderOptions }),
    new LineParagraphExtension(),
    new LineTextExtension(),
    new LineHardBreakExtension(),
    new LineBlockquoteExtension(),
    new LineHeadingExtension({}),
    new LineListExtension(),
    new LineCodeMirrorExtension({
      extensions: [
        ...getSetupByCodemirrorOptions({ ...codemirrorOptions, lineNumbers: true }),
        ...typewriterCmExtension,
      ],
      useProsemirrorHistoryKey: true,
      customCopyFunction,
    }),
    new LineHorizontalRuleExtension({}),
    new LineTableExtension({ resizable: false }),
    new LineTableHeaderCellExtension(),
    new LineTableRowExtension(),
    new LineTableCellExtension(),
    new FindExtension({
      decoration: { style: 'background-color: yellow; color: black' },
      activeDecoration: { style: 'background-color: orange; color: black' },
    }),
    new LivePreviewBlockExtension(options.livePreviewBlock ?? {}),
    new HtmlInlineNodeExtension({
      handleViewImgSrcUrl,
    }),
    new ClipboardExtension({
      imagePasteHandler,
      clipboardReadFunction,
    }),

    new ReactComponentExtension({}),
    new DropCursorExtension({
      className: 'rme-drop-cursor',
    }),

    new SlashMenuExtension(),
    new LineInlineMarkExtension(),
    new LineInlineDecorationExtension(),

    new MathBlockExtension(codemirrorNodeCommonOptions),
    new LineHtmlBlockExtension({ ...codemirrorNodeCommonOptions, handleViewImgSrcUrl }),
    new MermaidBlockExtension(codemirrorNodeCommonOptions),
    new MathInlineExtension({}),

    new ReferenceDefinitionExtension({}),
    new ReferenceLabelExtension({}),
    new ReferenceHrefExtension({}),
    new ReferenceTitleExtension({}),

    new TransformerExtension({}),
    new NodeIndicatorExtension(),
    typewriterScrollExtension,
  ]

  if (options.ai) {
    res.unshift(new AIExtension(options.ai))
    if (options.ai.copilot) {
      res.unshift(new CopilotExtension(options.ai.copilot))
    }
  }

  return res
}

export default extensions
