import type { CreateExtensionPlugin } from '@rme-sdk/core'
import { extension, isTextSelection, PlainExtension } from '@rme-sdk/core'
import type { EditorView } from '@rme-sdk/pm/view'
import { Decoration, DecorationSet } from '@rme-sdk/pm/view'
import { isBrowser } from '../../utils/common'
import { type CopilotContext, type CopilotOptions } from '../Ai/ai-types'

export type CopilotState = {
  status: 'idle' | 'loading' | 'ready'
  suggestion: string
  pos: number | null
  requestId: number
}

type CopilotMeta =
  | { type: 'loading'; pos: number; requestId: number }
  | { type: 'ready'; pos: number; suggestion: string; requestId: number }
  | { type: 'clear'; requestId: number }

console.log('123')

@extension<CopilotOptions>({
  defaultOptions: {},
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class CopilotExtension extends PlainExtension<CopilotOptions> {
  get name() {
    return 'copilot' as const
  }

  createPlugin(): CreateExtensionPlugin<CopilotState> {
    const initialState: CopilotState = {
      status: 'idle',
      suggestion: '',
      pos: null,
      requestId: 0,
    }

    const getSiblingParagraphText = (
      parentNode: EditorView['state']['doc'],
      startIndex: number,
      direction: -1 | 1,
    ) => {
      let index = startIndex + direction
      while (index >= 0 && index < parentNode.childCount) {
        const node = parentNode.child(index)
        if (node.type.name === 'paragraph') {
          const text = node.textBetween(0, node.content.size, '\n', '\n')
          return text || ''
        }
        index += direction
      }
      return null
    }

    const getContext = (viewState: EditorView['state']) => {
      if (!isTextSelection(viewState.selection) || !viewState.selection.empty) {
        return null
      }
      const $from = viewState.selection.$from
      const parent = $from.parent
      if (!parent.isTextblock) {
        return null
      }
      const textBefore = parent.textBetween(0, $from.parentOffset, '\n', '\n')
      const textAfter = parent.textBetween($from.parentOffset, parent.content.size, '\n', '\n')
      const maxContextChars = this.options.maxContextChars ?? 500
      const textBeforeContext =
        maxContextChars > 0 && textBefore.length > maxContextChars
          ? textBefore.slice(textBefore.length - maxContextChars)
          : textBefore
      const parentDepth = $from.depth - 1
      const rootParent = parentDepth >= 0 ? $from.node(parentDepth) : null
      const parentIndex = parentDepth >= 0 ? $from.index(parentDepth) : -1
      const prevParagraph =
        rootParent && parentIndex >= 0
          ? getSiblingParagraphText(rootParent, parentIndex, -1)
          : null
      const nextParagraph =
        rootParent && parentIndex >= 0
          ? getSiblingParagraphText(rootParent, parentIndex, 1)
          : null
      const hasContext = Boolean(
        textBeforeContext.trim() ||
          textAfter.trim() ||
          prevParagraph?.trim() ||
          nextParagraph?.trim(),
      )
      if (!hasContext) {
        return null
      }
      const context: CopilotContext = {
        nodeType: parent.type.name,
        textBefore: textBeforeContext,
        textAfter,
        prevParagraph,
        nextParagraph,
      }
      return {
        context,
        pos: viewState.selection.from,
      }
    }

    const normalizeSuggestion = (text: string, context: string) => {
      let suggestion = text.replace(/\r\n/g, '\n')
      if (suggestion.startsWith(context)) {
        suggestion = suggestion.slice(context.length)
      }
      suggestion = suggestion.replace(/^\s+/, '')
      const maxSuggestionChars = this.options.maxSuggestionChars ?? 500
      if (maxSuggestionChars > 0 && suggestion.length > maxSuggestionChars) {
        suggestion = suggestion.slice(0, maxSuggestionChars)
      }
      return suggestion
    }

    const acceptSuggestion = (view: EditorView, event?: KeyboardEvent) => {
      const state = this.pluginKey.getState(view.state)

      if (!state || state.status !== 'ready' || !state.suggestion) {
        return false
      }
      event?.preventDefault()
      const nextRequestId = state.requestId + 1
      view.dispatch(
        view.state.tr
          .insertText(state.suggestion)
          .setMeta(this.pluginKey, { type: 'clear', requestId: nextRequestId }),
      )
      return true
    }

    return {
      key: this.pluginKey,
      initialState,
      state: {
        init: () => initialState,
        apply: (tr, value) => {
          const meta = tr.getMeta(this.pluginKey) as CopilotMeta | undefined
          if (meta) {
            if (meta.type === 'loading') {
              return {
                ...value,
                status: 'loading',
                suggestion: '',
                pos: meta.pos,
                requestId: meta.requestId,
              }
            }
            if (meta.type === 'ready') {
              return {
                ...value,
                status: 'ready',
                suggestion: meta.suggestion,
                pos: meta.pos,
                requestId: meta.requestId,
              }
            }
            if (meta.type === 'clear') {
              return {
                ...value,
                status: 'idle',
                suggestion: '',
                pos: null,
                requestId: meta.requestId,
              }
            }
          }
          if (tr.docChanged || tr.selectionSet) {
            return { ...value, status: 'idle', suggestion: '', pos: null }
          }
          return value
        },
      },
      props: {
        decorations: (state) => {
          const pluginState = this.pluginKey.getState(state)
          if (!pluginState || pluginState.status !== 'ready' || !pluginState.pos) {
            return DecorationSet.empty
          }
          if (!isTextSelection(state.selection) || !state.selection.empty) {
            return DecorationSet.empty
          }
          if (state.selection.from !== pluginState.pos) {
            return DecorationSet.empty
          }
          if (!pluginState.suggestion.trim()) {
            return DecorationSet.empty
          }
          const deco = Decoration.widget(pluginState.pos, () => {
            if (!isBrowser()) return  document.createTextNode('')
            const span = document.createElement('span')
            span.className = 'rme-copilot-suggestion'
            span.textContent = pluginState.suggestion
            return span
          })
          return DecorationSet.create(state.doc, [deco])
        },
        handleKeyDown: (view, event) => {
          if (event.key !== 'Tab') {
            return false
          }
          return acceptSuggestion(view, event)
        },
      },
      view: (view) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        let requestId = 0
        const cancel = () => {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          requestId += 1
          view.dispatch(
            view.state.tr.setMeta(this.pluginKey, { type: 'clear', requestId }),
          )
        }

        const schedule = () => {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          timeoutId = setTimeout(async () => {
            const contextInfo = getContext(view.state)
            if (!contextInfo) {
              return
            }
            if (!this.options.generateText) {
              return
            }
            requestId += 1
            const currentRequestId = requestId
            view.dispatch(
              view.state.tr.setMeta(this.pluginKey, {
                type: 'loading',
                pos: contextInfo.pos,
                requestId: currentRequestId,
              }),
            )
            try {
              const text = await this.options.generateText({
                context: contextInfo.context,
              })

              console.log('currentRequestId', currentRequestId, requestId)

              if (currentRequestId !== requestId) {
                return
              }
              const suggestion = text
                ? normalizeSuggestion(text, contextInfo.context.textBefore)
                : ''
              if (!suggestion.trim()) {
                view.dispatch(
                  view.state.tr.setMeta(this.pluginKey, {
                    type: 'clear',
                    requestId: currentRequestId,
                  }),
                )
                return
              }
              view.dispatch(
                view.state.tr.setMeta(this.pluginKey, {
                  type: 'ready',
                  pos: contextInfo.pos,
                  suggestion,
                  requestId: currentRequestId,
                }),
              )
            } catch {
              if (currentRequestId === requestId) {
                view.dispatch(
                  view.state.tr.setMeta(this.pluginKey, {
                    type: 'clear',
                    requestId: currentRequestId,
                  }),
                )
              }
            }
          }, this.options.debounceMs ?? 500)
        }

        return {
          update: (nextView, prevState) => {
            if (nextView !== view) {
              return
            }
            const docChanged = !nextView.state.doc.eq(prevState.doc)
            const selectionChanged = !nextView.state.selection.eq(prevState.selection)
            if (!docChanged && !selectionChanged) {
              return
            }
            cancel()
            if (docChanged) {
              schedule()
            }
          },
          destroy: () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
          },
        }
      },
    }
  }
}
