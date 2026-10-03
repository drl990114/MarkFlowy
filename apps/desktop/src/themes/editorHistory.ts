import type { ThemeDocument } from '@markflowy/theme/semantic'
export interface ThemeHistory {
  past: ThemeDocument[]
  present: ThemeDocument
  future: ThemeDocument[]
}
export const createThemeHistory = (present: ThemeDocument): ThemeHistory => ({
  past: [],
  present,
  future: [],
})
export function changeTheme(
  history: ThemeHistory,
  next: ThemeDocument,
  grouped = false,
): ThemeHistory {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history
  return {
    past: grouped ? history.past : [...history.past.slice(-49), history.present],
    present: next,
    future: [],
  }
}
export function undoTheme(history: ThemeHistory): ThemeHistory {
  if (!history.past.length) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  }
}
export function redoTheme(history: ThemeHistory): ThemeHistory {
  if (!history.future.length) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  }
}
