import type { PluginKey } from "prosemirror-state"
import type { EditorView } from "prosemirror-view"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import type { SlashMenuMeta } from "./type"

export const dispatchWithMeta = (
  view: EditorView,
  key: PluginKey,
  meta: SlashMenuMeta
) => view.dispatch(view.state.tr.setMeta(key, meta))

export const isSlashKey = <T extends HTMLElement>(event: ReactKeyboardEvent<T> | KeyboardEvent) => {
  return event.key === "/"
}

export const getSlashFilterBeforeCursor = (view: EditorView): string | null => {
  const { selection } = view.state
  if (selection.from !== selection.to) return null
  const $from = selection.$from
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
  return getSlashFilterFromTextBeforeCursor(textBeforeCursor)
}

export const getSlashFilterFromTextBeforeCursor = (textBeforeCursor: string): string | null => {
  const slashIndex = textBeforeCursor.lastIndexOf('/')
  if (slashIndex < 0) return null
  const filter = textBeforeCursor.slice(slashIndex + 1)
  if (/\s/.test(filter)) return null
  return filter
}

export const defaultIgnoredKeys = [
  "Unidentified",
  "Alt",
  "AltGraph",
  "CapsLock",
  "Control",
  "Fn",
  "FnLock",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "F13",
  "F14",
  "F15",
  "F16",
  "F17",
  "F18",
  "F19",
  "F20",
  "F21",
  "F22",
  "F23",
  "F24",
  "Hyper",
  "Meta",
  "NumLock",
  "PageDown",
  "PageUp",
  "Pause",
  "PrintScreen",
  "Redo",
  "ScrollLock",
  "Shift",
  "Super",
  "Symbol",
  "SymbolLock",
  "Enter",
  "Tab",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  "Backspace",
  "Clear",
  "Copy",
  "CrSel",
  "Cut",
  "Delete",
  "EraseEof",
  "ExSel",
  "Insert",
  "Paste",
  "Redo",
  "Undo",
  "Accept",
  "Again",
  "Attn",
  "Cancel",
  "ContextMenu",
  "Escape",
  "Execute",
  "Find",
  "Finish",
  "Help",
  "Pause",
  "Play",
  "Props",
  "Select",
  "ZoomIn",
  "ZoomOut",
  "BrightnessDown",
  "BrightnessUp",
  "Eject",
  "LogOff",
  "Power",
  "PowerOff",
  "PrintScreen",
  "Hibernate",
  "Standby",
  "WakeUp",
  "AllCandidates",
  "Alphanumeric",
  "CodeInput",
  "Compose",
  "Convert",
  "Dead",
  "FinalMode",
  "GroupFirst",
  "GroupLast",
  "GroupNext",
  "GroupPrevious",
  "ModeChange",
  "NextCandidate",
  "NonConvert",
  "PreviousCandidate",
  "Process",
  "SingleCandidate",
  "HangulMode",
  "HanjaMode",
  "JunjaMode",
  "Eisu",
  "Hankaku",
  "Hiragana",
  "HiraganaKatakana",
  "KanaMode",
  "KanjiMode",
  "Katakana",
  "Romaji",
  "Zenkaku",
  "ZenkakuHanaku",
]
