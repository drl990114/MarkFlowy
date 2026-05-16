import { indentWithTab } from '@codemirror/commands'
import {
  ensureSyntaxTree,
  type LanguageDescription,
  type LanguageSupport,
} from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { SearchQuery } from '@codemirror/search'
import type {
  Extension as CodeMirrorExtension,
  Transaction as CodeMirrorTransaction,
} from '@codemirror/state'
import {
  EditorState as CodeMirrorEditorState,
  Compartment,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from '@codemirror/state'
import type {
  Command as CodeMirrorCommand,
  EditorViewConfig as CodeMirrorEditorViewConfig,
  KeyBinding as CodeMirrorKeyBinding,
  ViewUpdate,
} from '@codemirror/view'
import { Decoration, EditorView as CodeMirrorEditorView, keymap, ViewPlugin } from '@codemirror/view'
import { SyntaxNodeRef, Tree } from '@lezer/common'
import { assertGet, isPromise, replaceNodeAtPosition } from '@rme-sdk/core'
import type { EditorSchema, EditorView, ProsemirrorNode } from '@rme-sdk/pm'
import { exitCode } from '@rme-sdk/pm/commands'
import { redo, undo } from '@rme-sdk/pm/history'
import { Selection, TextSelection } from '@rme-sdk/pm/state'
import { nanoid } from 'nanoid'
import type { LoadLanguage } from '../extensions/CodeMirror/codemirror-node-view'
import { CustomCopyFunction } from '../extensions/CodeMirror/codemirror-types'
import { createCommandKeymap, type CommandKeymapOptions } from '../extensions/CodeMirror/keymap'
import { isBrowser } from '../utils/common'
import { lightTheme } from '../theme'
import type { CreateThemeOptions } from './theme'
import { createTheme } from './theme'

const cmInstanceMap = new Map<string, MfCodemirrorView>()
const themeRef = { current: createTheme(lightTheme.codemirrorTheme as CreateThemeOptions) }

type SearchHighlightState = {
  query: SearchQuery
  active: { from: number; to: number } | null
}

const setSearchHighlight = StateEffect.define<SearchHighlightState>()

const searchHighlightField = StateField.define<SearchHighlightState>({
  create() {
    return { query: new SearchQuery({ search: '' }), active: null }
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchHighlight)) {
        return effect.value
      }
    }
    return value
  },
})

const matchDecoration = Decoration.mark({ class: 'cm-search-match' })
const activeDecoration = Decoration.mark({ class: 'cm-search-active' })

const normalizeExtensions = (
  extensions: CodeMirrorExtension[] | null | undefined,
): CodeMirrorExtension[] => {
  const result: CodeMirrorExtension[] = []
  const stack = [...(extensions ?? [])] as unknown[]

  while (stack.length > 0) {
    const ext = stack.shift()
    if (!ext) {
      continue
    }
    if (Array.isArray(ext)) {
      stack.unshift(...ext)
      continue
    }
    result.push(ext as CodeMirrorExtension)
  }

  return result
}

const searchHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations

    constructor(view: CodeMirrorEditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.startState.field(searchHighlightField) !==
          update.state.field(searchHighlightField)
      ) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: CodeMirrorEditorView) {
      const { query, active } = view.state.field(searchHighlightField)
      if (!query.valid || !query.search) {
        return Decoration.none
      }

      const builder = new RangeSetBuilder<Decoration>()
      for (const { from, to } of view.visibleRanges) {
        const cursor = query.getCursor(view.state, from, to)
        while (true) {
          const next = cursor.next()
          if (next.done) {
            break
          }
          const range = next.value
          const deco =
            active && active.from === range.from && active.to === range.to
              ? activeDecoration
              : matchDecoration
          builder.add(range.from, range.to, deco)
        }
      }
      return builder.finish()
    }
  },
  {
    decorations: (value) => value.decorations,
  },
)

export const changeTheme = (theme: CreateThemeOptions): void => {
  themeRef.current = createTheme(theme)
  cmInstanceMap.forEach((mfCmView) => {
    mfCmView.cm.dispatch({
      effects: mfCmView.editorTheme.reconfigure(themeRef.current),
    })
  })
}

export const updateCodemirrorSearchQuery = (query: string, caseSensitive = false): void => {
  updateCodemirrorSearchState(query, caseSensitive, null)
}

export const updateCodemirrorSearchState = (
  query: string,
  caseSensitive = false,
  activeMatch?: { from: number; to: number } | null,
): void => {
  const searchQuery = new SearchQuery({
    search: query,
    caseSensitive,
  })
  cmInstanceMap.forEach((mfCmView) => {
    const range = mfCmView.getProsemirrorContentRange()
    const active =
      activeMatch &&
      activeMatch.from >= range.from &&
      activeMatch.to <= range.to
        ? { from: activeMatch.from - range.from, to: activeMatch.to - range.from }
        : null
    mfCmView.setSearchState(searchQuery, active)
  })
}

export const scrollCodemirrorToMatch = (
  activeMatch?: { from: number; to: number } | null,
): boolean => {
  if (!activeMatch) {
    return false
  }
  let scrolled = false
  cmInstanceMap.forEach((mfCmView) => {
    const range = mfCmView.getProsemirrorContentRange()
    if (activeMatch.from >= range.from && activeMatch.to <= range.to) {
      mfCmView.scrollToPosition(activeMatch.from - range.from)
      scrolled = true
    }
  })
  return scrolled
}

export const extractMatches = (view: CodeMirrorEditorView) => {
  const tree: Tree | null = ensureSyntaxTree(view.state, view.state.doc.length)
  const matches: any[] = []
  tree?.iterate({
    from: 0,
    to: view.state.doc.length,
    enter: ({ type, from, to }: SyntaxNodeRef) => {
      if (type.name.startsWith('ATXHeading')) {
        matches.push({ from, to, value: view.state.doc.sliceString(from, to), type: type.name })
      }
    },
  })

  return matches
}

export type CreateCodemirrorOptions = {
  /**
   * when it is true, undo and redo will use prosemirror view.
   */
  useProsemirrorHistoryKey?: boolean

  codemirrorEditorViewConfig?: CodeMirrorEditorViewConfig

  onValueChange?: (value: string) => void

  /**
   * Copy button configuration options
   */
  copyButton?: {
    /**
     * Whether to show the copy button
     * @default true
     */
    enabled?: boolean

    /**
     * Custom copy function to override default behavior
     */
    customCopyFunction?: CustomCopyFunction
  }

  /**
   * Command keymap options for customizing keyboard shortcuts
   */
  commandKeymapOptions?: CommandKeymapOptions
}

export class MfCodemirrorView {
  private readonly view: EditorView

  private readonly getPos: () => number

  private readonly languageConf: Compartment

  private readonly toggleName = 'paragraph'

  private readonly schema: EditorSchema

  private readonly searchQueryConf: Compartment

  private languageName: string

  id = nanoid()

  cm: CodeMirrorEditorView

  content = ''

  node: ProsemirrorNode

  editorTheme: Compartment

  updating = false

  loadLanguage: LoadLanguage

  options?: CreateCodemirrorOptions

  private copyButton: HTMLDivElement | null = null
  private copyButtonContainer: HTMLElement | null = null

  constructor({
    view,
    getPos,
    node,
    extensions = [],
    languageName,
    options = {},
  }: {
    node: ProsemirrorNode
    view: EditorView
    getPos: () => number
    extensions?: CodeMirrorExtension[] | null
    languageName: string
    options?: CreateCodemirrorOptions
  }) {
    this.view = view
    this.getPos = getPos
    this.node = node
    this.languageConf = new Compartment()
    this.editorTheme = new Compartment()
    this.searchQueryConf = new Compartment()
    this.schema = node.type.schema
    this.languageName = languageName
    this.loadLanguage = loadLanguage
    this.options = options
    this.content = this.node.textContent
    const changeFilter = CodeMirrorEditorState.changeFilter.of((tr: CodeMirrorTransaction) => {
      if (!tr.docChanged) {
        this.forwardSelection()
      }

      return true
    })

    const startState = CodeMirrorEditorState.create({
      doc: this.node.textContent as string,
      extensions: [
        keymap.of(this.codeMirrorKeymap()),
        changeFilter,
        this.searchQueryConf.of([searchHighlightField, searchHighlightPlugin]),
        this.languageConf.of([]),
        this.editorTheme.of(themeRef.current),
        ...normalizeExtensions(extensions),
      ],
    })

    // Create a CodeMirror instance
    this.cm = new CodeMirrorEditorView({
      state: startState,
      dispatch: this.valueChanged.bind(this),
      ...(this.options.codemirrorEditorViewConfig || {}),
    })

    cmInstanceMap.set(this.id, this)

    this.updateLanguage()

    // Create copy button if enabled
    if (this.options.copyButton?.enabled !== false) {
      this.createCopyButton()
    }
  }

  update(node: ProsemirrorNode): boolean {
    if (node.type !== this.node.type) {
      return false
    }

    this.node = node
    this.content = node.textContent
    this.updateLanguage()
    const change = computeChange(this.cm.state.doc.toString(), node.textContent)

    if (change) {
      this.updating = true
      this.cm.dispatch({
        changes: { from: change.from, to: change.to, insert: change.text },
      })
      this.updating = false
    }

    return true
  }

  setSelection(anchor: number, head: number): void {
    this.cm.focus()
    this.updating = true
    this.cm.dispatch({ selection: { anchor, head } })
    this.updating = false
  }

  updateLanguage() {
    const languageName = this.node.attrs.language
    if (languageName === this.languageName) {
      return
    }

    const language = this.loadLanguage(languageName)

    if (!language) {
      return
    }

    if (isPromise(language)) {
      language.then((lang) => {
        this.setLanguage(lang)
        this.languageName = languageName
      })
      return
    }

    this.setLanguage(language)
    this.languageName = languageName
  }

  destroy() {
    this.cm.destroy()
    cmInstanceMap.delete(this.id)
  }

  setSearchState(query: SearchQuery, active: { from: number; to: number } | null): void {
    this.cm.dispatch({ effects: setSearchHighlight.of({ query, active }) })
  }

  scrollToPosition(pos: number): void {
    const safePos = Math.max(0, Math.min(pos, this.cm.state.doc.length))
    this.cm.dispatch({ effects: CodeMirrorEditorView.scrollIntoView(safePos, { y: 'center' }) })
  }

  getProsemirrorContentRange(): { from: number; to: number } {
    const start = this.getPos() + 1
    return { from: start, to: start + this.node.content.size }
  }

  forwardSelection() {
    if (!this.cm.hasFocus) {
      return
    }

    const { state } = this.view
    const selection = this.asProseMirrorSelection(state.doc)

    if (!selection.eq(state.selection)) {
      this.view.dispatch(state.tr.setSelection(selection))
    }
  }

  private setLanguage(language: LanguageSupport) {
    this.cm.dispatch({
      effects: this.languageConf.reconfigure(language),
    })
  }

  private valueChanged(tr: CodeMirrorTransaction): void {
    if (!this.cm || !this.view) return

    this.cm.update([tr])

    if (!tr.docChanged || this.updating) {
      return
    }

    const change = computeChange(this.node.textContent, tr.state.doc.toString())

    if (change) {
      const start = this.getPos() + 1
      const transaction = this.view.state.tr.replaceWith(
        start + change.from,
        start + change.to,
        change.text ? this.schema.text(change.text) : [],
      )
      this.view.dispatch(transaction)

      this.options?.onValueChange?.(tr.state.doc.toString())
    }
  }

  private asProseMirrorSelection(doc: ProsemirrorNode) {
    const start = this.getPos() + 1
    const { anchor, head } = this.cm.state.selection.main
    return TextSelection.between(doc.resolve(anchor + start), doc.resolve(head + start))
  }

  private codeMirrorKeymap(): CodeMirrorKeyBinding[] {
    const keymaps: CodeMirrorKeyBinding[] = [
     indentWithTab,
      {
        key: 'ArrowUp',
        run: this.maybeEscape('line', -1),
      },
      {
        key: 'ArrowLeft',
        run: this.maybeEscape('char', -1),
      },
      {
        key: 'ArrowDown',
        run: this.maybeEscape('line', 1),
      },
      {
        key: 'ArrowRight',
        run: this.maybeEscape('char', 1),
      },
      {
        key: 'Ctrl-Enter',
        run: () => {
          if (exitCode(this.view.state, this.view.dispatch)) {
            this.view.focus()
            return true
          }

          return false
        },
      },
      {
        key: 'Backspace',
        run: () => {
          const { ranges } = this.cm.state.selection

          if (!this.cm || !ranges || ranges.length > 1) {
            return false
          }

          const selection = ranges[0]

          if (selection && (!selection.empty || selection.anchor > 0)) {
            return false
          }

          // We don't want to convert a multi-line code block into a paragraph
          // because newline characters are invalid in a paragraph node.
          if (this.cm.state.doc.lines >= 2) {
            return false
          }

          const { state } = this.view
          const toggleNode = assertGet(state.schema.nodes, this.toggleName)
          const pos = this.getPos()

          const tr = replaceNodeAtPosition({
            pos,
            tr: state.tr,
            content: toggleNode.createChecked({}, this.node.content),
          })

          tr.setSelection(TextSelection.near(tr.doc.resolve(pos)))

          this.view.dispatch(tr)
          this.view.focus()
          return true
        },
      },
      ...createCommandKeymap(this.options?.commandKeymapOptions)
    ]

    if (this.options?.useProsemirrorHistoryKey) {
      keymaps.push(
        {
          key: 'Mod-z',
          run: () => {
            undo(this.view.state, this.view.dispatch)
            this.view.focus()
            return false
          },
        },
        {
          key: 'Mod-y',
          mac: 'Mod-Shift-z',
          run: () => {
            redo(this.view.state, this.view.dispatch)
            this.view.focus()
            return false
          },
          preventDefault: true,
        },
        {
          linux: 'Ctrl-Shift-z',
          run: () => {
            redo(this.view.state, this.view.dispatch)
            this.view.focus()
            return false
          },
          preventDefault: true,
        },
      )
    }

    return keymaps
  }

  private maybeEscape(unit: 'line' | 'char', dir: 1 | -1): CodeMirrorCommand {
    return (view: CodeMirrorEditorView) => {
      const { state } = view

      // Exit if the selection is not empty
      if (state.selection.ranges.some((range) => !range.empty)) {
        return false
      }

      const { anchor } = state.selection.main

      const line = state.doc.lineAt(anchor)
      const lineOffset = anchor - line.from

      if (
        line.number !== (dir < 0 ? 1 : state.doc.lines) ||
        (unit === 'char' && lineOffset !== (dir < 0 ? 0 : line.length))
      ) {
        return false
      }

      if (unit === 'line' && dir < 0 && this.focusLanguageInput()) {
        return true
      }

      const targetPos = this.getPos() + (dir < 0 ? 0 : this.node.nodeSize)
      const selection = Selection.near(this.view.state.doc.resolve(targetPos), dir)

      if (dir === 1 && exitCode(this.view.state, this.view.dispatch)) {
        this.view.focus()
        return true
      }

      this.view.dispatch(this.view.state.tr.setSelection(selection).scrollIntoView())
      this.view.focus()
      return true
    }
  }

  private focusLanguageInput(): boolean {
    const nodeDom = this.view.nodeDOM(this.getPos()) as HTMLElement | null
    const parent = nodeDom?.parentElement
    if (!parent) {
      return false
    }
    let sibling: ChildNode | null = nodeDom.previousSibling
    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.classList.contains('code-block__menu')
      ) {
        const input = sibling.querySelector(
          '.code-block__languages__input',
        ) as HTMLInputElement | null
        if (input) {
          input.focus()
          return true
        }
        return false
      }
      sibling = sibling.previousSibling
    }
    return false
  }

  /**
   * Creates the copy button and adds it to the CodeMirror editor
   */
  private createCopyButton(): void {
    if (!this.cm.dom || !this.options || !isBrowser()) return

    // Create copy button
    this.copyButton = document.createElement('div')
    this.copyButton.className = 'cm-copy-btn'

    this.copyButton.innerHTML = `<i class="ri-file-copy-line"></i>`

    // Use custom tooltip or default
    const tooltip = 'Copy code'
    this.copyButton.title = tooltip

    // Add event listeners
    this.setupCopyButtonEvents()

    // Add container to CodeMirror editor
    this.cm.dom.appendChild(this.copyButton)

    // Enable pointer events on button
    this.copyButton.style.pointerEvents = 'auto'
  }

  /**
   * Sets up event listeners for the copy button
   */
  private setupCopyButtonEvents(): void {
    if (!this.copyButton) return

    // Hover effects
    this.copyButton.addEventListener('mouseenter', () => {
      if (!this.copyButton) return

      this.copyButton.style.transform = 'translateY(-1px)'
    })

    this.copyButton.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    this.copyButton.addEventListener('mouseleave', () => {
      if (!this.copyButton) return

      this.copyButton.style.transform = 'translateY(0)'
    })

    // Click handler for copying
    this.copyButton.addEventListener('click', this.handleCopy.bind(this), {
      capture: true,
    })
  }

  /**
   * Handles the copy button click event
   */
  private async handleCopy(e: MouseEvent): Promise<void> {
    e.stopPropagation()
    e.preventDefault()

    if (!this.options) return

    const code = this.node.textContent

    // Use custom copy function if provided
    if (this.options.copyButton?.customCopyFunction) {
      try {
        const result = this.options.copyButton.customCopyFunction(code)
        if (result instanceof Promise) {
          const success = await result
          if (success) {
            this.showCopySuccess()
          }
        } else {
          if (result) {
            this.showCopySuccess()
          }
        }
        return
      } catch (error) {
        console.error('Custom copy function failed:', error)
        // Fall back to default copy behavior
      }
    }

    // Default copy behavior
    if (isBrowser() && navigator.clipboard && window.isSecureContext) {
      // Use modern clipboard API
      try {
        await navigator.clipboard.writeText(code)
        this.showCopySuccess()
      } catch (error) {
        console.error('Clipboard API failed:', error)
      }
    } else {
    }
  }

  /**
   * Shows copy success feedback
   */
  private showCopySuccess(): void {
    if (!this.copyButton || !this.options) return

    const originalTitle = this.copyButton.title

    const successTooltip = 'Copied!'

    this.copyButton.innerHTML = `<i class="ri-check-line"></i>`
    this.copyButton.title = successTooltip
    this.copyButton.style.color = 'green'

    setTimeout(() => {
      if (this.copyButton) {
        this.copyButton.innerHTML = `<i class="ri-file-copy-line"></i>`
        this.copyButton.title = originalTitle
        this.copyButton.style.color = 'inherit'
      }
    }, 1500)
  }
}

export const getLanguageMap = (): Record<string, LanguageDescription> => {
  const languageMap: Record<string, LanguageDescription> = {}

  for (const language of languages ?? []) {
    for (const alias of language.alias) {
      languageMap[alias] = language
    }
  }

  return languageMap
}

export const loadLanguage = (
  languageName: string,
): Promise<LanguageSupport> | LanguageSupport | undefined => {
  if (typeof languageName !== 'string') {
    return undefined
  }

  const languageMap = getLanguageMap()
  const language = languageMap[languageName.toLowerCase()]

  if (!language) {
    return undefined
  }

  return language.support || language.load()
}

export function computeChange(
  oldVal: string,
  newVal: string,
): { from: number; to: number; text: string } | null {
  if (oldVal === newVal) {
    return null
  }

  let start = 0
  let oldEnd = oldVal.length
  let newEnd = newVal.length

  while (start < oldEnd && oldVal.charCodeAt(start) === newVal.charCodeAt(start)) {
    ++start
  }

  while (
    oldEnd > start &&
    newEnd > start &&
    oldVal.charCodeAt(oldEnd - 1) === newVal.charCodeAt(newEnd - 1)
  ) {
    oldEnd--
    newEnd--
  }

  return { from: start, to: oldEnd, text: newVal.slice(start, newEnd) }
}
