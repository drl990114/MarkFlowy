import { LineTableCellExtension, LineTableHeaderCellExtension } from './Table/table-extension'
import {
  // BoldExtension,
  // BulletListExtension,
  // CodeBlockExtension,
  DropCursorExtension,
  // MentionExtension,
  // EmojiExtension,
  // GapCursorExtension,
  // HardBreakExtension,
  // HeadingExtension,
  // HistoryExtension,
  // ItalicExtension,
  // LinkExtension,
  // ListItemExtension,
  // ListItemSharedExtension,
  // OrderedListExtension,
  // ShortcutsExtension,
  // StrikeExtension,
  // SubExtension,
  // TableCellExtension,
  // TableExtension,
  // TaskListExtension,
  // UnderlineExtension,
  // PlaceholderExtension,
} from 'remirror/extensions'
// import data from 'svgmoji/emoji.json'
import { LineInlineDecorationExtension, LineInlineMarkExtension, markExtensions } from './Inline'
import { LineHeadingExtension } from './Heading'
import { LineParagraphExtension } from './Paragraph'
import { LineTextExtension } from './Text'
import { LineListExtension } from './List'
import { corePreset } from '@remirror/preset-core'
import { LineBlockquoteExtension } from './BlockQuote'
import { LineHardBreakExtension } from './HardBreak'
import { ReactComponentExtension } from '@remirror/react'
import { LineCodeMirrorExtension } from './CodeMirror/codemirror-extension'
import { LineTableExtension, LineTableRowExtension } from './Table'
import { LineHorizontalRuleExtension } from './HorizontalRule'
import { CountExtension } from '@remirror/extension-count'
import { FindExtension } from '@remirror/extension-find'
import { LineHtmlBlockExtension } from './HtmlNode/html-block-extension'
import { HtmlImageExtension } from './Image'
import { IframeExtension } from './Iframe'
import { SlashMenuExtension } from './SlashMenu'
import { PlaceholderExtension } from './Placeholder'
import { ClipboardExtension } from './Clipboard'

// import { TableExtension } from './ReactTables';

export * from './List'

export type ExtensionsOptions = {
  handleViewImgSrcUrl?: (src: string) => Promise<string>
}

function extensions({ handleViewImgSrcUrl }: ExtensionsOptions): any[] {
  return [
    ...corePreset({ excludeExtensions: ['paragraph', 'text'] }),
    ...markExtensions({
      handleViewImgSrcUrl,
    }),
    new CountExtension({}),
    new HtmlImageExtension({
      handleViewImgSrcUrl,
    }),
    new IframeExtension({
      enableResizing: true,
    }),

    new PlaceholderExtension({ placeholder: 'Type \'/\' for commands' }),
    new LineHorizontalRuleExtension({}),
    new LineParagraphExtension(),
    new LineTextExtension(),
    new LineHardBreakExtension(),
    new LineBlockquoteExtension(),
    new LineHeadingExtension({}),
    new LineListExtension(),
    new LineCodeMirrorExtension({}),
    new LineTableExtension({ resizable: false }),
    new LineTableRowExtension(),
    new LineTableCellExtension(),
    new LineTableHeaderCellExtension(),
    new FindExtension({
      decoration: { style: 'background-color: yellow; color: black' },
      activeDecoration: { style: 'background-color: orange; color: black' },
    }),
    new LineHtmlBlockExtension(),
    new ClipboardExtension(),

    new ReactComponentExtension({}),
    new DropCursorExtension({}),

    new SlashMenuExtension(),
    new LineInlineMarkExtension(),
    new LineInlineDecorationExtension(),
  ]
}

export default extensions
