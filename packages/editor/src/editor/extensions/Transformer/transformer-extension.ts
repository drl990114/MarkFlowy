import type { CreateExtensionPlugin } from '@rme-sdk/core';
import { PlainExtension, extension } from '@rme-sdk/core';
import { DocToString, StringToDoc } from '../../types/index';

export type TransformerMenuState = {
  isTransformerFlag: true
  stringToDoc: StringToDoc | null
  docToString: DocToString | null
}
type TranformerOptions = {}

@extension<TranformerOptions>({
  defaultOptions: {},
})
export class TransformerExtension extends PlainExtension {
  get name() {
    return 'transformer' as const
  }

  createPlugin(): CreateExtensionPlugin<TransformerMenuState> {
    const initialState: TransformerMenuState = {
      isTransformerFlag: true,
      stringToDoc: null,
      docToString: null,
    }

    return {
      state: {
        init() {
          return initialState
        },
        apply: (tr, state) => {
          const meta = tr.getMeta(this.pluginKey)

          if (meta) {
            return {
              ...state,
              stringToDoc: meta.stringToDoc,
              docToString: meta.docToString,
            }
          }
          return state
        },
      },
      initialState,
    }
  }
}
