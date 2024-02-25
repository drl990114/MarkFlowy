import type { MenuItemData } from 'zens'
import { create } from 'zustand'

const useContextMenuStore = create<ContextMenuStore>((set) => {
  return {
    x: -9999,
    y: -9999,
    open: false,
    items: [],
    show: ({ x, y, items }) => {
      set({ x, y, items, open: true })
    },
    hide: () => {
      set({ x: -9999, y: -9999, items: [], open: false })
    },
  }
})

export interface IShowContextMenuParams {
  x: number
  y: number
  items: MenuItemData[]
}

interface ContextMenuStore {
  x: number
  y: number
  open: boolean
  items: MenuItemData[]
  show: (params: IShowContextMenuParams) => void
  hide: () => void
}

export default useContextMenuStore
