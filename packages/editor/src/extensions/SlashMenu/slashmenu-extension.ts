import { type SlashMenuState, type SlashMenuMeta, SlashMetaTypes } from './type'
import { defaultIgnoredKeys, dispatchWithMeta } from './utils'

import type { CreateExtensionPlugin } from 'remirror'
import { PlainExtension, extension } from 'remirror'
import { getCase, SlashCases } from './case'

type SlashMenuOptions = {}
@extension<SlashMenuOptions>({
  defaultOptions: {},
})
export class SlashMenuExtension extends PlainExtension {
  get name() {
    return 'slash-menu' as const
  }

  createPlugin(): CreateExtensionPlugin<SlashMenuState> {
    const initialState: SlashMenuState = {
      open: false,
      filter: '',
      ignoredKeys: defaultIgnoredKeys,
    }

    return {
      props: {
        handleKeyDown(view, event) {
          const editorState = view.state

          const state = this.getState(editorState)
          if (!state) return false
          const slashCase = getCase(state, event, view, initialState.ignoredKeys)

          switch (slashCase) {
            case SlashCases.OpenMenu:
              dispatchWithMeta(view, this.spec.key!, { type: SlashMetaTypes.open })
              return true
            case SlashCases.CloseMenu: {
              if (event.key === '/') {
                view.dispatch(
                  editorState.tr.insertText('/').setMeta(this.spec.key!, {
                    type: SlashMetaTypes.close,
                  }),
                )
              } else
                dispatchWithMeta(view, this.spec.key!, {
                  type: SlashMetaTypes.close,
                })
              return true
            }

            case SlashCases.Execute:
            case SlashCases.NextItem:
            case SlashCases.PrevItem:
            case SlashCases.addChar:
            case SlashCases.removeChar:
            case SlashCases.Catch: {
              return true
            }

            default:
              return false
          }
        },
      },

      state: {
        init() {
          return initialState
        },
        apply(tr, state) {
          // @ts-ignore
          const meta: SlashMenuMeta = tr.getMeta(this.spec.key)
          switch (meta?.type) {
            case SlashMetaTypes.open:
              return { ...initialState, open: true }
            case SlashMetaTypes.close:
              return initialState
            case SlashMetaTypes.execute:
              return {
                ...initialState,
                open: true,
              }
            default:
              return state
          }
        },
      },
      initialState,
    }
  }
}
