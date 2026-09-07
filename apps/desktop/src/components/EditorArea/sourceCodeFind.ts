import { SearchQuery } from '@codemirror/search'
import { Compartment, EditorState, StateEffect, type Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export interface SourceFindRequest {
  query: string
  caseSensitive?: boolean
  activeIndex?: number
}
export interface SourceFindMatch {
  from: number
  to: number
}
export interface SourceFindState {
  query: string
  caseSensitive: boolean
  activeIndex?: number
  matches: readonly SourceFindMatch[]
}
export interface SourceFindLocation {
  line: number
  startColumn: number
  endColumn: number
  lineText: string
  query: string
  caseSensitive?: boolean
}
const EMPTY_MATCHES: readonly SourceFindMatch[] = Object.freeze([])

/** Search the existing CodeMirror Text tree; never serialize the Markdown host. */
export class SourceFind {
  private state: SourceFindState = Object.freeze({
    query: '',
    caseSensitive: false,
    matches: EMPTY_MATCHES,
  })
  private document?: Text
  private revision = 0
  private destroyed = false
  private changes = new Compartment()
  private complete = false
  private refreshScheduled = false
  private listeners = new Set<(state: SourceFindState) => void>()

  constructor(
    private view: EditorView,
    private highlight: (query: SearchQuery, active: SourceFindMatch | null) => void,
  ) {
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        this.changes.of(
          EditorView.updateListener.of((update) => {
            if (update.docChanged) this.documentChanged()
          }),
        ),
      ),
    })
  }

  getState = () => this.state
  subscribe = (listener: (state: SourceFindState) => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(state: SourceFindState) {
    this.state = Object.freeze(state)
    this.listeners.forEach((listener) => listener(this.state))
    return this.state
  }
  open = () => this.state
  clear = () => {
    if (this.destroyed) return this.state
    this.revision += 1
    this.document = this.view.state.doc
    this.complete = true
    this.highlight(new SearchQuery({ search: '', literal: true }), null)
    return this.publish({ query: '', caseSensitive: false, matches: EMPTY_MATCHES })
  }
  close = this.clear

  searchAsync = async (request: SourceFindRequest, options: { signal?: AbortSignal } = {}) => {
    if (this.destroyed || options.signal?.aborted) return null
    const doc = this.view.state.doc
    const caseSensitive = request.caseSensitive === true
    if (
      this.complete &&
      this.document === doc &&
      request.query === this.state.query &&
      caseSensitive === this.state.caseSensitive
    ) {
      if (request.activeIndex !== undefined && this.state.matches.length) {
        const activeIndex =
          ((request.activeIndex % this.state.matches.length) + this.state.matches.length) %
          this.state.matches.length
        if (activeIndex !== this.state.activeIndex)
          return this.publish({ ...this.state, activeIndex })
      }
      return this.state
    }
    const revision = ++this.revision
    const current = () =>
      !this.destroyed &&
      !options.signal?.aborted &&
      revision === this.revision &&
      doc === this.view.state.doc
    const query = new SearchQuery({ search: request.query, caseSensitive, literal: true })
    const matches: SourceFindMatch[] = []
    let deadline = performance.now() + 8
    let nextOffset = 0
    if (query.valid) {
      for (let start = 0; start < doc.length; start += 65536) {
        const boundary = Math.min(doc.length, start + 65536)
        const cursor = query.getCursor(
          doc,
          Math.max(start, nextOffset),
          Math.min(doc.length, boundary + request.query.length),
        )
        for (
          let result = cursor.next();
          !result.done && result.value.from < boundary;
          result = cursor.next()
        ) {
          matches.push(Object.freeze({ from: result.value.from, to: result.value.to }))
          nextOffset = result.value.to
          if (performance.now() >= deadline) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 0)
            })
            if (!current()) return null
            deadline = performance.now() + 8
          }
        }
        if (performance.now() >= deadline) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0)
          })
          if (!current()) return null
          deadline = performance.now() + 8
        }
      }
    }
    if (!current()) return null
    this.document = doc
    this.complete = true
    const requestedIndex =
      request.activeIndex ??
      (request.query === this.state.query ? (this.state.activeIndex ?? 0) : 0)
    const activeIndex = matches.length
      ? ((requestedIndex % matches.length) + matches.length) % matches.length
      : undefined
    this.highlight(query, activeIndex === undefined ? null : matches[activeIndex])
    return this.publish({
      query: request.query,
      caseSensitive,
      activeIndex,
      matches: Object.freeze(matches),
    })
  }

  navigateTo = async (index: number, options: { signal?: AbortSignal } = {}) => {
    if (this.destroyed || options.signal?.aborted) return null
    if (this.document !== this.view.state.doc && !(await this.searchAsync(this.state, options)))
      return null
    if (this.destroyed || options.signal?.aborted || !this.state.matches.length) return null
    const activeIndex =
      ((index % this.state.matches.length) + this.state.matches.length) % this.state.matches.length
    const match = this.state.matches[activeIndex]
    this.highlight(
      new SearchQuery({
        search: this.state.query,
        caseSensitive: this.state.caseSensitive,
        literal: true,
      }),
      match,
    )
    this.view.dispatch({
      selection: { anchor: match.from, head: match.to },
      effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
    })
    this.publish({ ...this.state, activeIndex })
    return match
  }
  next = () => this.navigateTo((this.state.activeIndex ?? -1) + 1)
  previous = () => this.navigateTo((this.state.activeIndex ?? 0) - 1)
  revealSourceMatch = async (
    target: SourceFindLocation,
    options: { signal?: AbortSignal } = {},
  ) => {
    if (this.destroyed || options.signal?.aborted) return null
    const doc = this.view.state.doc
    if (
      !Number.isInteger(target.line) ||
      !Number.isInteger(target.startColumn) ||
      !Number.isInteger(target.endColumn) ||
      target.line < 1 ||
      target.line > doc.lines
    )
      return { status: 'stale' as const }
    const line = doc.line(target.line)
    if (
      line.text !== target.lineText ||
      target.startColumn < 0 ||
      target.endColumn > line.length ||
      target.endColumn <= target.startColumn
    )
      return { status: 'stale' as const }
    const query = new SearchQuery({
      search: target.query,
      caseSensitive: target.caseSensitive,
      literal: true,
    })
    const from = line.from + target.startColumn
    const to = line.from + target.endColumn
    const candidate = query.valid ? query.getCursor(doc, from, to).next() : null
    if (!candidate || candidate.done || candidate.value.from !== from || candidate.value.to !== to)
      return { status: 'stale' as const }
    this.revision += 1
    this.complete = false
    this.document = doc
    this.publish({
      query: target.query,
      caseSensitive: target.caseSensitive === true,
      activeIndex: 0,
      matches: Object.freeze([Object.freeze({ from, to })]),
    })
    await this.navigateTo(0, options)
    return { status: 'exact' as const }
  }
  replace = async (replacement: string) => {
    if (this.destroyed || this.view.state.facet(EditorState.readOnly)) return false
    const state = await this.searchAsync(this.state)
    const match = state?.matches[state.activeIndex ?? 0]
    if (!match) return false
    this.view.dispatch({ changes: { ...match, insert: replacement } })
    await this.searchAsync(this.state)
    await this.navigateTo(state?.activeIndex ?? 0)
    return true
  }
  replaceAll = async (replacement: string) => {
    if (this.destroyed || this.view.state.facet(EditorState.readOnly)) return 0
    const state = await this.searchAsync(this.state)
    if (!state?.matches.length) return 0
    this.view.dispatch({
      changes: state.matches.map((match) => ({ ...match, insert: replacement })),
    })
    await this.searchAsync(this.state)
    return state.matches.length
  }
  documentChanged() {
    this.revision += 1
    if (!this.state.query || !this.listeners.size || this.refreshScheduled) return
    this.refreshScheduled = true
    // CodeMirror update listeners cannot dispatch another transaction inline.
    queueMicrotask(() => {
      this.refreshScheduled = false
      if (
        !this.destroyed &&
        this.state.query &&
        this.listeners.size &&
        this.document !== this.view.state.doc
      )
        void this.searchAsync(this.state)
    })
  }
  destroy() {
    if (this.destroyed) return
    try {
      this.clear()
    } catch {
      /* The native view may already have been removed. */
    }
    this.destroyed = true
    this.revision += 1
    this.listeners.clear()
    try {
      this.view.dispatch({ effects: this.changes.reconfigure([]) })
    } catch {
      /* Already destroyed. */
    }
  }
}
