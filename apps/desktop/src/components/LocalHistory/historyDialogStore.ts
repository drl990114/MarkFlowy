import { create } from 'zustand'

export const useHistoryDialog = create<{ open: boolean; fileId?: string }>(() => ({ open: false }))
export function openLocalHistory(fileId?: string) {
  useHistoryDialog.setState({ open: true, fileId })
  return true
}
