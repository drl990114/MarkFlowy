import { LineTableCellExtension, LineTableHeaderCellExtension } from './Table/table-extension'
import {
  // BoldExtension,
  // BulletListExtension,
  // CodeBlockExtension,
  DropCursorExtension,
  // EmojiExtension,
  // GapCursorExtension,
  // HardBreakExtension,
  // HeadingExtension,
  // HistoryExtension,
  // ImageExtension,
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
  PlaceholderExtension,
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

// import { TableExtension } from './ReactTables';

export * from './List'

export type ExtensionsOptions = {
  handleViewImgSrcUrl?: (src: string) => Promise<string>
}
function extensions({ handleViewImgSrcUrl }: ExtensionsOptions = {}): any[] {
  return [
    // new BoldExtension(),
    // new CodeBlockExtension(),
    // new GapCursorExtension(),
    // new HardBreakExtension(),
    // new HistoryExtension(),
    // new ItalicExtension(),
    // new MarkdownExtension(),
    // new ShortcutsExtension(),
    // new StrikeExtension(),
    // new SubExtension(),
    // new UnderlineExtension(),
    // new TableExtension(),
    // new TableCellExtension(),
    // new TaskListExtension(),
    // new LinkExtension({
    //   autoLink: true,
    // }),
    // new DropCursorExtension(),
    // new OrderedListExtension(),
    // new BulletListExtension(),
    // new ListItemExtension(),
    // new ListItemSharedExtension(),
    // new EmojiExtension({ data }),
    // new ImageExtension({}),
    ...corePreset({ excludeExtensions: ['paragraph', 'text'] }),
    ...markExtensions({
      handleViewImgSrcUrl
    }),
    new CountExtension(),

    new PlaceholderExtension({ placeholder: 'Type something...' }),
    new LineHorizontalRuleExtension(),
    new LineParagraphExtension(),
    new LineTextExtension(),
    new LineHardBreakExtension(),
    new LineBlockquoteExtension(),
    new LineHeadingExtension(),
    new LineListExtension(),
    new LineCodeMirrorExtension(),
    new LineTableExtension({ resizable: false }),
    new LineTableRowExtension(),
    new LineTableCellExtension(),
    new LineTableHeaderCellExtension(),
    new FindExtension({
      decoration: { style: 'background-color: yellow; color: black' },
      activeDecoration: { style: 'background-color: orange; color: black' },
    }),
    new LineHtmlBlockExtension(),

    new ReactComponentExtension(),
    new DropCursorExtension(),

    new LineInlineMarkExtension(),
    new LineInlineDecorationExtension(),
  ]
}

export default extensions
