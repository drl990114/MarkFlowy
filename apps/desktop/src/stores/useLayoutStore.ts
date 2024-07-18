import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useLayoutStore = create(
  immer<EditorViewTypeStore>((set) => {
    return {
      leftBar: {
        visible: true,
      },
      rightBar: {
        visible: true,
      },

      setLeftBarVisible: (visible: boolean) => {
        set((state) => {
          state.leftBar.visible = visible
        })
      },

      setRightBarVisible: (visible: boolean) => {
        set((state) => {
          state.rightBar.visible = visible
        })
      }
    }
  }),
)

type LayoutItem = {
  visible: boolean
}
type EditorViewTypeStore = {
  leftBar: LayoutItem
  rightBar: LayoutItem
  setLeftBarVisible: (visible: boolean) => void
  setRightBarVisible: (visible: boolean) => void
}

export default useLayoutStore
