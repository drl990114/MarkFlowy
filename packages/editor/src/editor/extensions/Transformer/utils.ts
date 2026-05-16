import { EditorView } from '@rme-sdk/main'
import { TransformerMenuState } from './transformer-extension'

export const getTransformerByView = (view: EditorView): Partial<TransformerMenuState> => {
  const ext = view.state.plugins.find((plugin) => {
    return plugin.spec.initialState?.isTransformerFlag === true
  })

  return ext?.getState(view.state) || {}
}
