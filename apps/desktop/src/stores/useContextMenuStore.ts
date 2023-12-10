import type { MenuItemData } from '@markflowy/components'
import { create } from 'zustand'

const useContextMenuStore = create<ContextMenuStore>((set) => {
  return {
    x: -9999,
    y: -9999,
    items: [],
    show: ({ x, y, items }) => {
      set({ x, y, items })
    },
    hide: () => {
      set({ x: -9999, y: -9999 })
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
  items: MenuItemData[]
  show: (params: IShowContextMenuParams) => void
  hide: () => void
}

export default useContextMenuStore
