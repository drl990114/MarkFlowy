import type { MenuDividerType, MenuGroupType } from 'zens'
import { create } from 'zustand'

export type DesktopMenuGroupType = Omit<MenuGroupType, 'children'> & {
  children?: DesktopMenuItemData[]
  disabled?: boolean
}

export type DesktopMenuItemData = DesktopMenuGroupType | MenuDividerType

const useContextMenuStore = create<ContextMenuStore>((set) => {
  return {
    x: 0,
    y: 0,
    open: false,
    items: [],
    show: ({ x, y, items }) => {
      set({ x, y, items, open: true })
    },
    hide: () => {
      set({ x: 0, y: 0, items: [], open: false })
    },
  }
})

export interface IShowContextMenuParams {
  x: number
  y: number
  items: DesktopMenuItemData[]
}

interface ContextMenuStore {
  x: number
  y: number
  open: boolean
  items: DesktopMenuItemData[]
  show: (params: IShowContextMenuParams) => void
  hide: () => void
}

export default useContextMenuStore
