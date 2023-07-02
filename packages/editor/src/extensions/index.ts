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
  // MarkdownExtension,
  // OrderedListExtension,
  // ShortcutsExtension,
  // StrikeExtension,
  // SubExtension,
  // TableCellExtension,
  // TableExtension,
  // TaskListExtension,
  // UnderlineExtension,
} from 'remirror/extensions'
// import data from 'svgmoji/emoji.json'
import { LineInlineDecorationExtension, LineInlineMarkExtension, markExtensions } from './Inline'
import { LineHeadingExtension } from './Heading'
import { LineParagraphExtension } from './Paragraph'
import { LineTextExtension } from './Text'
import { LineListExtension } from './List'
import { corePreset } from "@remirror/preset-core"
import { LineBlockquoteExtension } from './BlockQuote'
import { LineHardBreakExtension } from './HardBreak'
import { ReactComponentExtension } from '@remirror/react'
import { LineCodeMirrorExtension } from './CodeMIrror/codemirror-extension'
import { LineTableExtension, LineTableRowExtension } from './Table'
// import { TableExtension } from './ReactTables';

export * from './List'

function extensions(): any[] {
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
    ...corePreset({ excludeExtensions: ["paragraph", "text"] }),
    ...markExtensions,
    new LineParagraphExtension(),
    new LineTextExtension(),
    new LineHardBreakExtension(),
    new LineBlockquoteExtension(),
    new LineHeadingExtension(),
    new LineListExtension(),
    new LineCodeMirrorExtension(),
    new LineTableExtension(),
    new LineTableRowExtension(),
    new LineTableCellExtension(),
    new LineTableHeaderCellExtension(),

    new ReactComponentExtension(),
    new DropCursorExtension(),
    
    new LineInlineMarkExtension(),
    new LineInlineDecorationExtension(),
  ]
}

export default extensions
