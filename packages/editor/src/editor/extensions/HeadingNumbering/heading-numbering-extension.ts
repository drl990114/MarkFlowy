import type { CommandFunction, CreateExtensionPlugin, Helper } from '@rme-sdk/sdk/core'
import { extension, PlainExtension } from '@rme-sdk/sdk/core'
import {
  analyzeHeadingNumberingDocument,
  hasHeadingStructureChanged,
  removeHeadingNumbering,
  rewriteHeadingNumbering,
  type HeadingNumberingAnalysis,
} from './heading-numbering'

type HeadingNumberingMeta = 'apply' | 'auto' | 'remove'

@extension({ defaultOptions: {} })
export class HeadingNumberingExtension extends PlainExtension {
  get name() {
    return 'headingNumbering' as const
  }

  applyHeadingNumbering = (): CommandFunction => {
    return ({ tr, dispatch }) => {
      const analysis = analyzeHeadingNumberingDocument(tr.doc)
      if (!analysis.hasHeadings) {
        return false
      }
      if (!dispatch) {
        return true
      }
      rewriteHeadingNumbering(tr, { replaceLoosePrefixes: true })
      dispatch(tr.setMeta(this.pluginKey, 'apply' satisfies HeadingNumberingMeta))
      return true
    }
  }

  removeHeadingNumbering = (): CommandFunction => {
    return ({ tr, dispatch }) => {
      const analysis = analyzeHeadingNumberingDocument(tr.doc)
      if (!analysis.entries.some((entry) => entry.prefix)) {
        return false
      }
      if (!dispatch) {
        return true
      }
      removeHeadingNumbering(tr)
      dispatch(tr.setMeta(this.pluginKey, 'remove' satisfies HeadingNumberingMeta))
      return true
    }
  }

  getHeadingNumbering = (): Helper<HeadingNumberingAnalysis> => {
    return analyzeHeadingNumberingDocument(this.store.view.state.doc)
  }

  createCommands() {
    return {
      applyHeadingNumbering: this.applyHeadingNumbering,
      removeHeadingNumbering: this.removeHeadingNumbering,
    }
  }

  createHelpers() {
    return {
      getHeadingNumbering: this.getHeadingNumbering,
    }
  }

  createPlugin(): CreateExtensionPlugin {
    return {
      key: this.pluginKey,
      appendTransaction: (transactions, oldState, newState) => {
        if (!transactions.some((transaction) => transaction.docChanged)) {
          return null
        }
        if (transactions.some((transaction) => transaction.getMeta(this.pluginKey))) {
          return null
        }

        const previous = analyzeHeadingNumberingDocument(oldState.doc)
        if (!previous.complete) {
          return null
        }
        const next = analyzeHeadingNumberingDocument(newState.doc)
        if (next.complete || !hasHeadingStructureChanged(previous, next)) {
          return null
        }

        const tr = rewriteHeadingNumbering(newState.tr, {
          previousAnalysis: previous,
        })
        return tr.docChanged
          ? tr.setMeta(this.pluginKey, 'auto' satisfies HeadingNumberingMeta)
          : null
      },
    }
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      headingNumbering: HeadingNumberingExtension
    }
  }
}
