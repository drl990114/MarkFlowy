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
              if (event.isComposing) {
                dispatchWithMeta(view, this.spec.key!, {
                  type: SlashMetaTypes.close,
                })
              } else if (isSlashKey(event)) {
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
