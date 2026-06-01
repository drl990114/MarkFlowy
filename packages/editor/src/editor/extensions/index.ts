import {
  // BoldExtension,
  // BulletListExtension,
  // CodeBlockExtension,
  DropCursorExtension,
} from '@rme-sdk/main/extensions'
import { LineTableCellExtension, LineTableHeaderCellExtension } from './Table/table-extension'
// import data from 'svgmoji/emoji.json'
import { CountExtension } from '@rme-sdk/extension-count'
import { corePreset } from '@rme-sdk/preset-core'
import { ReactComponentExtension } from '@rme-sdk/react'
import { ClipboardReadFunction, clipboardRead } from '../utils/clipboard-read'
import { isBrowser } from '../utils/common'
import { AIExtension } from './Ai'
import { AIOptions } from './Ai/ai-types'
import { LineBlockquoteExtension } from './BlockQuote'
import { ClipboardExtension } from './Clipboard'
import { LineCodeMirrorExtension } from './CodeMirror/codemirror-extension'
import { CustomCopyFunction } from './CodeMirror/codemirror-types'
import { CodemirrorOptions, getSetupByCodemirrorOptions } from './CodeMirror/setup'
import { CommonKeymapExtension } from './CommonKeymap'
import { CopilotExtension } from './Copilot/copilot-extension'
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
import { DelayedImage, FileWithProgress, MdImgUriExtension } from './Image/md-image-extension'
import { LineInlineDecorationExtension, LineInlineMarkExtension, markExtensions } from './Inline'
import { LineListExtension } from './List'
import { MathBlockExtension, MathInlineExtension } from './Math'
import { MermaidBlockExtension } from './Mermaid'
import { NodeIndicatorExtension } from './NodeIndicator'
import { LineParagraphExtension } from './Paragraph'
import { PlaceholderExtension, PlaceholderOptions } from './Placeholder'
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
import { TypewriterScrollExtension, TypewriterScrollOptions } from './TypewriterScroll'
import { LinkClickExtension, LinkClickHandler } from './LinkClick'

export * from './Image'
export * from './List'

export type ExtensionsOptions = {
  disableAllBuildInShortcuts?: boolean

  handleViewImgSrcUrl?: (src: string) => Promise<string>

  imageHostingHandler?: (src: string) => Promise<string>

  imagePasteHandler?: (src: string) => Promise<string>

  ai?: AIOptions

  customCopyFunction?: CustomCopyFunction

  overrideShortcutMap?: Record<string, string>

  clipboardReadFunction?: ClipboardReadFunction

  codemirrorOptions?: CodemirrorOptions

  uploadImageHandler?: (files: FileWithProgress[]) => DelayedImage[]

  typewriterScroll?: TypewriterScrollOptions

  placeholder?: PlaceholderOptions

  handleLinkClick?: LinkClickHandler
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
