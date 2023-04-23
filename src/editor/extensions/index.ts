import {
  BoldExtension,
  BulletListExtension,
  CodeBlockExtension,
  EmojiExtension,
  GapCursorExtension,
  HardBreakExtension,
  HeadingExtension,
  HistoryExtension,
  ItalicExtension,
  LinkExtension,
  ListItemExtension,
  ListItemSharedExtension,
  OrderedListExtension,
  ShortcutsExtension,
  StrikeExtension,
  SubExtension,
  TableCellExtension,
  TableExtension,
  TaskListExtension,
  UnderlineExtension,
} from 'remirror/extensions'
import { MarkdownExtension } from './markdown'

function extensions() {
  return [
    new BoldExtension(),
    new CodeBlockExtension(),
    new GapCursorExtension(),
    new HardBreakExtension(),
    new HeadingExtension(),
    new HistoryExtension(),
    new ItalicExtension(),
    new MarkdownExtension(),
    new ShortcutsExtension(),
    new StrikeExtension(),
    new SubExtension(),
    new UnderlineExtension(),
    new TableExtension(),
    new TableCellExtension(),
    new TaskListExtension(),
    new LinkExtension(),
    new OrderedListExtension(),
    new BulletListExtension(),
    new ListItemExtension(),
    new ListItemSharedExtension(),
    new EmojiExtension(),
  ]
}

export default extensions
