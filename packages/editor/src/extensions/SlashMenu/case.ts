import type { EditorView } from '@remirror/pm/view'
import type { SlashMenuState, OpeningConditions } from './type'

export enum SlashCases {
  OpenMenu = 'openMenu',
  CloseMenu = 'closeMenu',
  Execute = 'Execute',
  NextItem = 'NextItem',
  PrevItem = 'PrevItem',
  inputChange = 'InputChange',
  addChar = 'addChar',
  removeChar = 'removeChar',
  Ignore = 'Ignore',
  Catch = 'Catch',
}
const defaultConditions = (openInSelection = false): OpeningConditions => {
  return {
    shouldOpen: (state: SlashMenuState, event: KeyboardEvent, view: EditorView) => {
      const editorState = view.state
      const resolvedPos =
        editorState.selection.from < 0 || editorState.selection.from > editorState.doc.content.size
          ? null
          : editorState.doc.resolve(editorState.selection.from)

      const parentNode = resolvedPos?.parent
      const inParagraph = parentNode?.type.name === 'paragraph'
      const inEmptyPar = inParagraph && parentNode?.nodeSize === 2
      const posInLine = editorState.selection.$head.parentOffset
      const prevCharacter = editorState.selection.$head.parent.textContent.slice(
        posInLine - 1,
        posInLine,
      )
      const spaceBeforePos = prevCharacter === ' ' || prevCharacter === '' || prevCharacter === ' '
      return (
        !state.open &&
        event.key === '/' &&
        inParagraph &&
        (inEmptyPar ||
          spaceBeforePos ||
          (editorState.selection.from !== editorState.selection.to && openInSelection))
      )
    },
    shouldClose: (state: SlashMenuState, event: KeyboardEvent) =>
      state.open &&
      (event.key === '/' || event.key === 'Escape' || event.key === 'Backspace') &&
      state.filter.length === 0,
  }
}
export const getCase = (
  state: SlashMenuState,
  event: KeyboardEvent,
  view: EditorView,
  ignoredKeys: string[],
  customConditions?: OpeningConditions,
  shouldOpenInSelection?: boolean,
): SlashCases => {
  const condition = customConditions || defaultConditions(shouldOpenInSelection)
  if (condition.shouldOpen(state, event, view)) {
    return SlashCases.OpenMenu
  }
  if (condition.shouldClose(state, event, view)) {
    return SlashCases.CloseMenu
  }
  if (state.open) {
    if (event.key === 'ArrowDown') {
      return SlashCases.NextItem
    }
    if (event.key === 'ArrowUp') {
      return SlashCases.PrevItem
    }
    if (
      event.key === 'Enter' ||
      event.key === 'Tab'
    ) {
      return SlashCases.Execute
    }
    if (
      event.key === 'Escape' ||
      (event.key === 'Backspace' && state.filter.length === 0)
    ) {
      return SlashCases.CloseMenu
    }
    if (state.filter.length > 0 && event.key === 'Backspace') {
      return SlashCases.removeChar
    }
    if (!ignoredKeys.includes(event.key)) {
      return SlashCases.addChar
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      return SlashCases.Catch
    }
  }

  return SlashCases.Ignore
}
