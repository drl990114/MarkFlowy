import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useLayoutStore = create(
  immer<LayoutStore>((set) => {
    return {
      leftBar: {
        visible: true,
      },
      rightBar: {
        visible: true,
      },
      zenModeActive: false,

      setLeftBarVisible: (visible: boolean) => {
        set((state) => {
          state.leftBar.visible = visible
        })
      },

      setRightBarVisible: (visible: boolean) => {
        set((state) => {
          state.rightBar.visible = visible
        })
      },

      setZenModeActive: (active: boolean) => {
        set((state) => {
          state.zenModeActive = active
        })
      },

      toggleZenMode: () => {
        set((state) => {
          state.zenModeActive = !state.zenModeActive
        })
      },
    }
  }),
)

type LayoutItem = {
  visible: boolean
}
type LayoutStore = {
  leftBar: LayoutItem
  rightBar: LayoutItem
  zenModeActive: boolean
  setLeftBarVisible: (visible: boolean) => void
  setRightBarVisible: (visible: boolean) => void
  setZenModeActive: (active: boolean) => void
  toggleZenMode: () => void
}

export default useLayoutStore
