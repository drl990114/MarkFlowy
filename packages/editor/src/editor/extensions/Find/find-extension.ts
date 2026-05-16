import type { CommandFunction, FromToProps, Helper, ProsemirrorPlugin } from '@rme-sdk/core'
import { extension, PlainExtension } from '@rme-sdk/core'
import type { EditorState } from '@rme-sdk/pm/state'
import { TextSelection } from '@rme-sdk/pm/state'
import type { DecorationAttrs } from '@rme-sdk/pm/view'
import type { SearchResult } from 'prosemirror-search'
import {
  getMatchHighlights,
  search,
  SearchQuery,
  setSearchState,
} from 'prosemirror-search'
import { scrollCodemirrorToMatch, updateCodemirrorSearchState } from '../../codemirror/codemirror'
import type { FindAndReplaceAllProps, FindAndReplaceProps, FindProps, FindResult } from './find-types'
import { rotateIndex } from './find-utils'

export interface FindOptions {
  decoration?: DecorationAttrs
  activeDecoration?: DecorationAttrs
  alwaysFind?: boolean
}

@extension<FindOptions>({
  defaultOptions: {
    alwaysFind: false,
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class FindExtension extends PlainExtension<FindOptions> {
  get name() {
    return 'find' as const
  }

  find = ({ query, activeIndex, caseSensitive }: FindProps): CommandFunction => {
    if (!query) {
      return this.stopFind()
    }

    return ({ state, tr, dispatch }) => {
      const searchQuery = new SearchQuery({
        search: query,
        caseSensitive: caseSensitive ?? false,
      })

      if (!searchQuery.valid) {
        return false
      }

      if (!dispatch) {
        return true
      }

      setSearchState(tr, searchQuery)

      let activeMatch: { from: number; to: number } | null = null
      if (activeIndex != null) {
        const results = this.collectQueryMatches(state, searchQuery)
        const normalizedIndex = rotateIndex(activeIndex, results.length)
        const target = results[normalizedIndex]
        if (target) {
          tr.setSelection(TextSelection.create(tr.doc, target.from, target.to)).scrollIntoView()
          activeMatch = { from: target.from, to: target.to }
        }
      }

      dispatch(tr)
      updateCodemirrorSearchState(query, caseSensitive ?? false, activeMatch)
      this.scrollToActiveResult(activeMatch)
      return true
    }
  }

  stopFind = (): CommandFunction => {
    return ({ tr, dispatch }) => {
      if (!dispatch) {
        return true
      }

      setSearchState(tr, new SearchQuery({ search: '' }))
      dispatch(tr)
      updateCodemirrorSearchState('', false, null)
      return true
    }
  }

  findAndReplace = ({
    query,
    caseSensitive,
    replacement,
    index,
  }: FindAndReplaceProps): CommandFunction => {
    return ({ state, tr, dispatch }) => {
      const searchQuery = new SearchQuery({
        search: query,
        replace: replacement,
        caseSensitive: caseSensitive ?? false,
      })

      if (!searchQuery.valid) {
        return false
      }

      if (!dispatch) {
        return true
      }

      const results = this.collectQueryMatches(state, searchQuery)
      if (!results.length) {
        setSearchState(tr, searchQuery)
        dispatch(tr)
        updateCodemirrorSearchState(query, caseSensitive ?? false, null)
        return false
      }

      const { activeIndex } = this.getHighlightRanges(state)
      const normalizedIndex = rotateIndex(
        index ?? activeIndex ?? 0,
        results.length,
      )
      const target = results[normalizedIndex]

      if (!target) {
        return false
      }

      setSearchState(tr, searchQuery)
      const replacements = searchQuery.getReplacements(state, target)

      for (let i = replacements.length - 1; i >= 0; i--) {
        const { from, to, insert } = replacements[i]
        tr.replaceRange(from, to, insert)
      }

      const mappedFrom = tr.mapping.map(target.from)
      const mappedTo = tr.mapping.map(target.to)
      tr.setSelection(TextSelection.create(tr.doc, mappedFrom, mappedTo)).scrollIntoView()

      dispatch(tr)
      updateCodemirrorSearchState(query, caseSensitive ?? false, { from: mappedFrom, to: mappedTo })
      this.scrollToActiveResult({ from: mappedFrom, to: mappedTo })
      return true
    }
  }

  findAndReplaceAll = ({
    query,
    caseSensitive,
    replacement,
  }: FindAndReplaceAllProps): CommandFunction => {
    return ({ state, tr, dispatch }) => {
      const searchQuery = new SearchQuery({
        search: query,
        replace: replacement,
        caseSensitive: caseSensitive ?? false,
      })

      if (!searchQuery.valid) {
        return false
      }

      if (!dispatch) {
        return true
      }

      const results = this.collectQueryMatches(state, searchQuery)

      setSearchState(tr, searchQuery)

      for (let i = results.length - 1; i >= 0; i--) {
        const replacements = searchQuery.getReplacements(state, results[i])
        for (let j = replacements.length - 1; j >= 0; j--) {
          const { from, to, insert } = replacements[j]
          tr.replaceRange(from, to, insert)
        }
      }

      dispatch(tr)
      updateCodemirrorSearchState(query, caseSensitive ?? false, null)
      return true
    }
  }

  findRanges = (options: FindProps): Helper<FindResult> => {
    this.store.commands.find(options)
    const { ranges, activeIndex } = this.getHighlightRanges(this.store.view.state)
    return {
      activeIndex,
      ranges,
    }
  }

  createCommands() {
    return {
      find: this.find,
      stopFind: this.stopFind,
      findAndReplace: this.findAndReplace,
      findAndReplaceAll: this.findAndReplaceAll,
    }
  }

  createHelpers() {
    return { findRanges: this.findRanges }
  }

  createExternalPlugins(): ProsemirrorPlugin[] {
    return [search({})]
  }

  private collectQueryMatches(
    state: EditorState,
    searchQuery: SearchQuery,
    range?: { from: number; to: number },
  ): SearchResult[] {
    if (!searchQuery.valid) {
      return []
    }

    const results: SearchResult[] = []
    const from = range?.from ?? 0
    const to = range?.to ?? state.doc.content.size
    let pos = from

    while (pos <= to) {
      const result = searchQuery.findNext(state, pos, to)
      if (!result) {
        break
      }
      results.push(result)
      const nextPos = result.to > pos ? result.to : pos + 1
      if (nextPos > to) {
        break
      }
      pos = nextPos
    }

    return results
  }

  private scrollToActiveResult(activeMatch?: { from: number; to: number } | null): void {
    if (!activeMatch) {
      return
    }

    if (scrollCodemirrorToMatch(activeMatch)) {
      return
    }

    const view = this.store.view
    const maxSize = view.state.doc.content.size
    const pos = activeMatch.from
    if (pos > maxSize) {
      return
    }

    const dom = view.domAtPos(pos).node as HTMLElement
    dom?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }

  private getHighlightRanges(state: EditorState): FindResult {
    const decorationSet = getMatchHighlights(state)
    if (!decorationSet) {
      return { ranges: [], activeIndex: undefined }
    }

    const decorations = decorationSet.find()
    const sorted = decorations
      .map((deco) => ({
        from: deco.from,
        to: deco.to,
      }))
      .sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from))

    const ranges: FromToProps[] = sorted.map(({ from, to }) => ({ from, to }))
    const { from: selectionFrom, to: selectionTo } = state.selection
    const activeIndex = sorted.findIndex(
      (deco) => deco.from === selectionFrom && deco.to === selectionTo,
    )

    return {
      ranges,
      activeIndex: activeIndex >= 0 ? activeIndex : undefined,
    }
  }

}

declare global {
  namespace Remirror {
    interface AllExtensions {
      find: FindExtension
    }
  }
}
