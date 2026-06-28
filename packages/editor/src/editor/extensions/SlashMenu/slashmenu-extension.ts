import { type SlashMenuMeta, type SlashMenuState, SlashMetaTypes } from './type'
import { defaultIgnoredKeys, dispatchWithMeta, isSlashKey } from './utils'

import type { CreateExtensionPlugin } from '@rme-sdk/main'
import { extension, PlainExtension } from '@rme-sdk/main'
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
    let isComposing = false
    const initialState: SlashMenuState = {
      open: false,
      filter: '',
      ignoredKeys: defaultIgnoredKeys,
    }

    return {
      props: {
        handleKeyDown(view, event) {
          const editorState = view.state

          if (!editorState) return false

          const state = this.getState(editorState)
          if (!state) return false
          if (event.key === 'Escape' && state.open) {
            dispatchWithMeta(view, this.spec.key!, { type: SlashMetaTypes.close })
            return true
          }

          if (event.isComposing || isComposing || event.key === 'Process') {
            return false
          }

          const slashCase = getCase(state, event, view, initialState.ignoredKeys)

          switch (slashCase) {
            case SlashCases.OpenMenu:
              const resolvedPos =
                editorState.selection.from < 0 ||
                editorState.selection.from > editorState.doc.content.size
                  ? null
                  : editorState.doc.resolve(editorState.selection.from)

              const parentNode = resolvedPos?.parent
              const inParagraph = parentNode?.type.name === 'paragraph'
              const inRoot = resolvedPos?.depth === 1

              if (!inRoot) {
                return false
              }

              if (inParagraph && parentNode.textContent === '/' && resolvedPos) {
                // 主要处理 safari 上input事件在这里已经触发了的问题
                view.dispatch(
                  editorState.tr
                    .delete(resolvedPos.start(), resolvedPos.end())
                    .setMeta(this.spec.key!, { type: SlashMetaTypes.open }),
                )
              }
              dispatchWithMeta(view, this.spec.key!, { type: SlashMetaTypes.open })
              return true
            case SlashCases.CloseMenu: {
              if (isSlashKey(event)) {
                view.dispatch(
                  editorState.tr.insertText('/').setMeta(this.spec.key!, {
                    type: SlashMetaTypes.close,
                  }),
                )
              } else {
                dispatchWithMeta(view, this.spec.key!, {
                  type: SlashMetaTypes.close,
                })
              }
              return true
            }

            case SlashCases.Execute:
            case SlashCases.NextItem:
            case SlashCases.PrevItem:
            case SlashCases.Catch: {
              return true
            }

            case SlashCases.removeChar: {
              dispatchWithMeta(view, this.spec.key!, {
                type: SlashMetaTypes.inputChange,
                filter: state.filter.slice(0, -1),
              })
              return true
            }

            case SlashCases.addChar: {
              if (event.key.length === 1) {
                dispatchWithMeta(view, this.spec.key!, {
                  type: SlashMetaTypes.inputChange,
                  filter: `${state.filter}${event.key}`,
                })
              }
              return true
            }

            default:
              return false
          }
        },
        handleTextInput(view, _from, _to, text) {
          const state = this.getState(view.state)
          if (!state?.open || !text) return false

          dispatchWithMeta(view, this.spec.key!, {
            type: SlashMetaTypes.inputChange,
            filter: `${state.filter}${text}`,
          })
          return true
        },
        handleDOMEvents: {
          compositionstart: () => {
            isComposing = true
            return false
          },
          compositionend: () => {
            isComposing = false
            return false
          },
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
            case SlashMetaTypes.inputChange:
              return {
                ...state,
                filter: meta.filter ?? '',
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
