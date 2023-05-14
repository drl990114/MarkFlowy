import {
  BoldExtension,
  BulletListExtension,
  CodeBlockExtension,
  DropCursorExtension,
  EmojiExtension,
  GapCursorExtension,
  HardBreakExtension,
  HeadingExtension,
  HistoryExtension,
  ImageExtension,
  ItalicExtension,
  LinkExtension,
  ListItemExtension,
  ListItemSharedExtension,
  MarkdownExtension,
  OrderedListExtension,
  ShortcutsExtension,
  StrikeExtension,
  SubExtension,
  TableCellExtension,
  TableExtension,
  TaskListExtension,
  UnderlineExtension,
} from 'remirror/extensions'
import data from 'svgmoji/emoji.json';

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
    new LinkExtension({
      autoLink: true,
    }),
    new DropCursorExtension(),
    new OrderedListExtension(),
    new BulletListExtension(),
    new ListItemExtension(),
    new ListItemSharedExtension(),
    new EmojiExtension({ data }),
    new ImageExtension({}),
  ]
}

export default extensions
