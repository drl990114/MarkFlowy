import type { EditorView } from "prosemirror-view"

export enum SlashMetaTypes {
  open = "open",
  close = "close",
  execute = "execute",
  nextItem = "nextItem",
  prevItem = "prevItem",
  inputChange = "inputChange",
}

export type SlashMenuState = {
  open: boolean;
  filter: string;
  ignoredKeys: string[];
  callbackOnClose?: () => void;
};

export interface SlashMenuMeta {
  type: SlashMetaTypes;
  filter?: string;
}
export interface OpeningConditions {
  shouldOpen: (
    state: SlashMenuState,
    event: KeyboardEvent,
    view: EditorView
  ) => boolean;
  shouldClose: (
    state: SlashMenuState,
    event: KeyboardEvent,
    view: EditorView
  ) => boolean;
}
