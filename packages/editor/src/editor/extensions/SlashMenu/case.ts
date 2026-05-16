import type { EditorView } from '@rme-sdk/pm/view'
import type { OpeningConditions, SlashMenuState } from './type'
import { isSlashKey } from './utils'

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
      // 检查是否在输入法组合状态中，如果是则不触发SlashMenu
      if (event.isComposing) {
        return false
      }

      const editorState = view.state
      const resolvedPos =
        editorState.selection.from < 0 || editorState.selection.from > editorState.doc.content.size
          ? null
          : editorState.doc.resolve(editorState.selection.from)

      const parentNode = resolvedPos?.parent
      const inParagraph = parentNode?.type.name === 'paragraph'
      const posInLine = editorState.selection.$head.parentOffset
      const prevCharacter = editorState.selection.$head.parent.textContent.slice(
        posInLine - 1,
        posInLine,
      )
      const inEmptyPar = inParagraph && parentNode?.textContent === prevCharacter

      const spaceBeforePos = prevCharacter === ' ' || prevCharacter === '' || prevCharacter === ' '

      return (
        !state.open &&
        isSlashKey(event) &&
        inParagraph &&
        (inEmptyPar ||
          spaceBeforePos ||
          (editorState.selection.from !== editorState.selection.to && openInSelection))
      )
    },
    shouldClose: (state: SlashMenuState, event: KeyboardEvent) =>
      state.open &&
      (isSlashKey(event) || event.key === 'Escape' || event.key === 'Backspace') &&
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
  // 在输入法组合状态下，忽略大部分键盘事件
  if (event.isComposing) {
    // 只处理一些特殊键，如Escape、Backspace等
    if (event.key === 'Escape') {
      return SlashCases.CloseMenu
    }
    if (event.key === 'Backspace' && state.filter.length === 0) {
      return SlashCases.CloseMenu
    }
    // 其他事件在组合状态下忽略
    return SlashCases.Ignore
  }

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
    if (event.key === 'Enter' || event.key === 'Tab') {
      return SlashCases.Execute
    }
    if (event.key === 'Escape' || (event.key === 'Backspace' && state.filter.length === 0)) {
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
