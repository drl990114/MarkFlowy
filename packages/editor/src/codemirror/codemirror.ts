import type {
  Extension as CodeMirrorExtension,
  Transaction as CodeMirrorTransaction,
} from '@codemirror/state'
import { Compartment, EditorState as CodeMirrorEditorState } from '@codemirror/state'
import type {
  Command as CodeMirrorCommand,
  KeyBinding as CodeMirrorKeyBinding,
} from '@codemirror/view'
import { EditorView as CodeMirrorEditorView, keymap } from '@codemirror/view'
import { assertGet, isPromise, replaceNodeAtPosition } from '@remirror/core'
import type { EditorSchema, EditorView, ProsemirrorNode } from '@remirror/pm'
import { exitCode } from '@remirror/pm/commands'
import { Selection, TextSelection } from '@remirror/pm/state'
import { mfCodemirrorLight } from '@markflowy/theme'
import type { LanguageDescription, LanguageSupport } from '@codemirror/language'
import type { LoadLanguage } from '@/extensions/CodeMirror/codemirror-node-view'
import { languages } from '@codemirror/language-data'
import type { Extension } from '@codemirror/state'
import { nanoid } from 'nanoid'

const cmInstanceMap = new Map<string, MfCodemirrorView>()
const themeRef = { current: mfCodemirrorLight }

class MfCodemirrorView {
  private readonly view: EditorView
  private readonly getPos: () => number
  private readonly languageConf: Compartment
  private readonly toggleName = 'paragraph'
  private readonly schema: EditorSchema
  private languageName: string

  id = nanoid()
  cm: CodeMirrorEditorView
  content = ''
  node: ProsemirrorNode
  editorTheme: Compartment
  updating = false
  loadLanguage: LoadLanguage

  constructor({
    view,
    getPos,
    node,
    extensions = [],
    languageName,
    createParams = {},
  }: {
    node: ProsemirrorNode
    view: EditorView
    getPos: () => number
    extensions?: CodeMirrorExtension[] | null
    languageName: string
    createParams?: Record<string, any>
  }) {
    this.view = view
    this.getPos = getPos
    this.node = node
    this.languageConf = new Compartment()
    this.editorTheme = new Compartment()
    this.schema = node.type.schema
    this.languageName = languageName
    this.loadLanguage = loadLanguage

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
        this.languageConf.of([]),
        this.editorTheme.of(themeRef.current),
        ...(extensions ?? []),
      ],
    })

    // Create a CodeMirror instance
    this.cm = new CodeMirrorEditorView({
      state: startState,
      dispatch: this.valueChanged.bind(this),
      ...createParams,
    })

    cmInstanceMap.set(this.id, this)

    this.updateLanguage()
  }

  changeTheme(theme: Extension): void {
    themeRef.current = theme
    cmInstanceMap.forEach((mfCmView) => {
      mfCmView.cm.dispatch({
        effects: mfCmView.editorTheme.reconfigure(theme),
      })
    })
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

  forwardSelection() {
    if (!this.cm.hasFocus) {
      return
    }

    const state = this.view.state
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
    if (!this.cm) return

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
    }
  }

  private asProseMirrorSelection(doc: ProsemirrorNode) {
    const start = this.getPos() + 1
    const { anchor, head } = this.cm.state.selection.main
    return TextSelection.between(doc.resolve(anchor + start), doc.resolve(head + start))
  }

  private codeMirrorKeymap(): CodeMirrorKeyBinding[] {
    return [
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
          const ranges = this.cm.state.selection.ranges

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

          const state = this.view.state
          const toggleNode = assertGet(state.schema.nodes, this.toggleName)
          const pos = this.getPos()

          const tr = replaceNodeAtPosition({
            pos: pos,
            tr: state.tr,
            content: toggleNode.createChecked({}, this.node.content),
          })

          tr.setSelection(TextSelection.near(tr.doc.resolve(pos)))

          this.view.dispatch(tr)
          this.view.focus()
          return true
        },
      },
    ]
  }

  private maybeEscape(unit: 'line' | 'char', dir: 1 | -1): CodeMirrorCommand {
    return (view: CodeMirrorEditorView) => {
      const { state } = view

      // Exit if the selection is not empty
      if (state.selection.ranges.some((range) => !range.empty)) {
        return false
      }

      const anchor = state.selection.main.anchor

      const line = state.doc.lineAt(anchor)
      const lineOffset = anchor - line.from

      if (
        line.number !== (dir < 0 ? 1 : state.doc.lines) ||
        (unit === 'char' && lineOffset !== (dir < 0 ? 0 : line.length))
      ) {
        return false
      }

      const targetPos = this.getPos() + (dir < 0 ? 0 : this.node.nodeSize)
      const selection = Selection.near(this.view.state.doc.resolve(targetPos), dir)

      this.view.dispatch(this.view.state.tr.setSelection(selection).scrollIntoView())
      this.view.focus()
      return true
    }
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

export default MfCodemirrorView
