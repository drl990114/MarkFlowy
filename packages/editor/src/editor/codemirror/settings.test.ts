import { resolveCodeEditorPreferences } from '../../../../../apps/desktop/src/components/EditorArea/codeEditorSettings'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { indentMore, undo, undoDepth } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { EditorView as CodeMirrorEditorView, keymap, runScopeHandlers } from '@codemirror/view'
import { LivePreviewNodeView } from '../extensions/LivePreviewBlock/LivePreviewNodeView'
import { closeBracketsKeymap, insertBracket } from '@codemirror/autocomplete'
import { Schema } from '@rme-sdk/sdk/pm/model'
import { EditorState } from '@rme-sdk/sdk/pm/state'
import { EditorView } from '@rme-sdk/sdk/pm/view'
import { CodeMirror6NodeView } from '../extensions/CodeMirror/codemirror-node-view'
import {
  basicSetup,
  sourceSetup,
  minimalSetup,
  type CodemirrorOptions,
} from '../extensions/CodeMirror/setup'
import { type MfCodemirrorView, updateCodemirrorSettings } from './codemirror'

const schema = new Schema({
  nodes: {
    doc: { content: 'codeMirror+' },
    codeMirror: {
      content: 'text*',
      code: true,
      marks: '',
      attrs: { language: { default: '' }, 'front-matter': { default: false } },
      toDOM: () => ['pre', 0],
    },
    text: { group: 'inline' },
  },
})
const cleanups: (() => void)[] = []
beforeEach(() => {
  // jsdom has no text layout; avoid feeding zero-height measurements back into
  // CodeMirror's height map while testing its real state and DOM configuration.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0))
})
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function mount(
  options: CodemirrorOptions = {},
  profile: 'source' | 'embedded' | 'frontmatter' = 'source',
) {
  const container = document.createElement('div')
  document.body.append(container)
  const instances: MfCodemirrorView[] = []
  const content = 'a  \n\tb\nc\nd\ne\nf\ng\nh\ni\nj\nk'
  const node = schema.node(
    'codeMirror',
    { 'front-matter': profile === 'frontmatter' },
    schema.text(content),
  )
  const view = new EditorView(container, {
    state: EditorState.create({ schema, doc: schema.node('doc', null, node) }),
    nodeViews: {
      codeMirror: (child, owner, getPos) =>
        new CodeMirror6NodeView({
          node: child,
          view: owner,
          getPos: () => getPos()!,
          extensions: [profile === 'source' ? sourceSetup : minimalSetup],
          toggleName: 'paragraph',
          options: {
            settingsProfile: profile,
            codemirrorOptions: options,
            preserveLineEndings: profile === 'source',
            copyButton: { enabled: false },
          },
          onCodemirrorViewLoad: (instance) => instances.push(instance),
        }),
    },
  })
  cleanups.push(() => {
    view.destroy()
    container.remove()
  })
  return { view, source: instances[0], instances, node, content }
}

const updated = () => new Promise<void>((resolve) => setTimeout(resolve, 5))
const hasPairDeletion = (view: MfCodemirrorView) =>
  view.cm.state
    .facet(keymap)
    .flat()
    .some((binding) => binding === closeBracketsKeymap[0])

describe('CodeMirror settings', () => {
  it('connects persisted Desktop preferences to real source and embedded editor extensions', () => {
    const preferences = resolveCodeEditorPreferences({
      editor_code_indent_style: 'tabs',
      editor_code_indent_size: '8',
      editor_code_auto_close_brackets: false,
      editor_code_whitespace: 'trailing',
      source_code_editor_line_wrap: 'off',
      source_code_editor_line_numbers: 'off',
      embedded_code_editor_line_wrap: 'on',
      embedded_code_editor_line_numbers: 'sparse',
      embedded_code_editor_highlight_active_line: 'on',
    })
    const source = mount(preferences.source).source
    const embedded = mount(preferences.rmeEmbedded, 'embedded').source
    expect(source.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(false)
    expect(source.cm.dom.querySelector('.cm-lineNumbers')).toBeNull()
    expect(source.cm.state.facet(indentUnit)).toBe('\t')
    expect(source.cm.state.tabSize).toBe(8)
    expect(hasPairDeletion(source)).toBe(false)
    expect(source.cm.dom.querySelector('.cm-trailingSpace')).not.toBeNull()
    expect(embedded.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(true)
    expect(embedded.cm.dom.querySelector('.cm-activeLine')).not.toBeNull()
    expect(
      [...embedded.cm.dom.querySelectorAll('.cm-lineNumbers .cm-gutterElement')].map(
        (node) => node.textContent,
      ),
    ).not.toContain('2')
  })

  it('preserves profile defaults, including sparse source numbers and hidden Frontmatter numbers', () => {
    const source = mount().source
    const embedded = mount({}, 'embedded').source
    const frontmatter = mount({}, 'frontmatter').source
    expect(source.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(true)
    expect(source.cm.dom.querySelector('.cm-activeLine')).not.toBeNull()
    expect(
      [...source.cm.dom.querySelectorAll('.cm-lineNumbers .cm-gutterElement')].map(
        (node) => node.textContent,
      ),
    ).toContain('10')
    expect(
      [...source.cm.dom.querySelectorAll('.cm-lineNumbers .cm-gutterElement')].map(
        (node) => node.textContent,
      ),
    ).not.toContain('2')
    expect(embedded.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(false)
    expect(embedded.cm.dom.querySelector('.cm-activeLine')).toBeNull()
    expect(embedded.cm.dom.querySelector('.cm-lineNumbers')).not.toBeNull()
    expect(frontmatter.cm.dom.querySelector('.cm-lineNumbers')).toBeNull()
    expect(source.cm.state.tabSize).toBe(4)
    expect(source.cm.state.facet(indentUnit)).toBe('  ')
  })

  it('reconfigures without replacing views, content, history, selection or owner transactions', async () => {
    const { source, view } = mount()
    const cm = source.cm
    cm.dispatch({ changes: { from: 0, insert: 'x' }, selection: { anchor: 1 } })
    const depth = undoDepth(cm.state)
    const selection = cm.state.selection
    const ownerState = view.state
    const doc = cm.state.doc
    cm.focus()
    const forwardSelection = vi.spyOn(source, 'forwardSelection')
    cm.scrollDOM.scrollTop = 37
    cm.scrollDOM.scrollLeft = 12
    source.updateSettings({
      lineWrapping: false,
      lineNumbers: 'off',
      highlightActiveLine: false,
      whitespace: 'all',
      indentSize: 8,
      autoCloseBrackets: false,
    })
    await updated()
    expect(forwardSelection).not.toHaveBeenCalled()
    expect(source.cm).toBe(cm)
    expect(cm.state.doc).toBe(doc)
    expect(cm.state.selection.eq(selection)).toBe(true)
    expect(view.state).toBe(ownerState)
    expect(undoDepth(cm.state)).toBe(depth)
    expect(cm.scrollDOM.scrollTop).toBe(37)
    expect(cm.scrollDOM.scrollLeft).toBe(12)
    expect(cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(false)
    expect(cm.dom.querySelector('.cm-lineNumbers')).toBeNull()
    expect(cm.dom.querySelector('.cm-foldGutter')).not.toBeNull()
    expect(cm.dom.querySelector('.cm-highlightSpace')).not.toBeNull()
    expect(cm.dom.querySelector('.cm-highlightTab')).not.toBeNull()
    expect(cm.dom.querySelector('.cm-activeLine')).toBeNull()
    expect(hasPairDeletion(source)).toBe(false)
    expect(cm.state.tabSize).toBe(8)
    expect(undo(cm)).toBe(true)
    source.updateSettings({})
    await updated()
    expect(cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(true)
    expect(cm.state.tabSize).toBe(4)
    expect(cm.state.facet(indentUnit)).toBe('  ')
    expect(cm.dom.querySelector('.cm-highlightSpace')).toBeNull()
    expect(hasPairDeletion(source)).toBe(true)
  })

  it('applies actual indentation and bracket insertion/deletion, with YAML constrained to spaces', async () => {
    const { source } = mount({ indentStyle: 'tabs', indentSize: 8 })
    const yaml = mount({ indentStyle: 'tabs', indentSize: 4 }, 'frontmatter').source
    indentMore(source.cm)
    indentMore(yaml.cm)
    expect(source.cm.state.doc.toString()).toMatch(/^\ta/)
    expect(yaml.cm.state.doc.toString()).toMatch(/^ {4}a/)
    source.cm.dispatch({
      changes: { from: 0, to: source.cm.state.doc.length, insert: '' },
      selection: { anchor: 0 },
    })
    const input = (text: string) => {
      const { from, to } = source.cm.state.selection.main
      return source.cm.state
        .facet(CodeMirrorEditorView.inputHandler)
        .some((handler) =>
          handler(source.cm, from, to, text, () =>
            source.cm.state.update({ changes: { from, to, insert: text } }),
          ),
        )
    }
    expect(input('(')).toBe(true)
    expect(source.cm.state.doc.toString()).toBe('()')
    expect(
      runScopeHandlers(source.cm, new KeyboardEvent('keydown', { key: 'Backspace' }), 'editor'),
    ).toBe(true)
    expect(source.cm.state.doc.toString()).toBe('')
    expect(input('(')).toBe(true)
    source.updateSettings({ autoCloseBrackets: false })
    await updated()
    expect(
      runScopeHandlers(source.cm, new KeyboardEvent('keydown', { key: 'Backspace' }), 'editor'),
    ).toBe(true)
    expect(source.cm.state.doc.toString()).toBe(')')
    expect(input('[')).toBe(false)
  })

  it('keeps paired Backspace before the default keymap in standalone basicSetup', () => {
    const cm = new CodeMirrorEditorView({ extensions: [basicSetup] })
    cleanups.push(() => cm.destroy())
    cm.dispatch(insertBracket(cm.state, '(')!)
    expect(cm.state.doc.toString()).toBe('()')
    runScopeHandlers(cm, new KeyboardEvent('keydown', { key: 'Backspace' }), 'editor')
    expect(cm.state.doc.toString()).toBe('')
  })

  it.each(['embedded', 'frontmatter'] as const)(
    'preserves default single-character Backspace in %s',
    (profile) => {
      const { source } = mount({}, profile)
      source.cm.dispatch({
        changes: { from: 0, to: source.cm.state.doc.length, insert: '' },
        selection: { anchor: 0 },
      })
      source.cm.dispatch(insertBracket(source.cm.state, '(')!)
      expect(source.cm.state.doc.toString()).toBe('()')
      expect(hasPairDeletion(source)).toBe(false)
      runScopeHandlers(source.cm, new KeyboardEvent('keydown', { key: 'Backspace' }), 'editor')
      expect(source.cm.state.doc.toString()).toBe(')')
    },
  )

  it('isolates owners and persists the complete replacement for later instances', async () => {
    const first = mount({ lineWrapping: false }, 'embedded')
    const second = mount({}, 'embedded')
    updateCodemirrorSettings(first.view, { lineWrapping: true, lineNumbers: 'off' })
    await updated()
    expect(first.source.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(true)
    expect(second.source.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(false)
    first.view.dispatch(first.view.state.tr.insert(first.view.state.doc.content.size, first.node))
    expect(first.instances[1].cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(true)
    expect(first.instances[1].cm.dom.querySelector('.cm-lineNumbers')).toBeNull()
    updateCodemirrorSettings(first.view, {})
    await updated()
    expect(
      first.instances.every(
        (instance) => !instance.cm.contentDOM.classList.contains('cm-lineWrapping'),
      ),
    ).toBe(true)
    expect(
      first.instances.every((instance) => instance.cm.dom.querySelector('.cm-lineNumbers')),
    ).toBe(true)
  })

  it('defers from compositionstart before CodeMirror has received the first composed character', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 0),
    )
    const { source } = mount()
    let started = true
    vi.spyOn(source.cm, 'composing', 'get').mockReturnValue(false)
    vi.spyOn(source.cm, 'compositionStarted', 'get').mockImplementation(() => started)
    source.updateSettings({ lineNumbers: 'off', indentSize: 8 })
    await vi.advanceTimersByTimeAsync(50)
    expect(source.cm.state.tabSize).toBe(4)
    expect(source.cm.dom.querySelector('.cm-lineNumbers')).not.toBeNull()
    started = false
    source.cm.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(10)
    expect(source.cm.state.tabSize).toBe(8)
    expect(source.cm.dom.querySelector('.cm-lineNumbers')).toBeNull()
  })

  it.each(['commit', 'cancel'])(
    'waits for composition %s and applies only the latest snapshot',
    async (ending) => {
      vi.useFakeTimers()
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn(() => 0),
      )
      const { source, view } = mount()
      let composing = true
      vi.spyOn(source.cm, 'composing', 'get').mockImplementation(() => composing)
      source.updateSettings({ lineWrapping: false, indentSize: 8 })
      source.updateSettings({ lineWrapping: false, indentSize: 4 })
      expect(source.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(true)
      if (ending === 'commit')
        source.cm.dispatch({ changes: { from: 0, insert: '中文' }, selection: { anchor: 2 } })
      const content = source.cm.state.doc.toString()
      source.cm.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
      await vi.advanceTimersByTimeAsync(25)
      expect(source.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(true)
      composing = false
      await vi.advanceTimersByTimeAsync(25)
      expect(source.cm.contentDOM.classList.contains('cm-lineWrapping')).toBe(false)
      expect(source.cm.state.tabSize).toBe(4)
      expect(source.cm.state.doc.toString()).toBe(content)
      expect(view.state.doc.textContent).toBe(content)
    },
  )

  it('updates hidden preview source and uses the owner snapshot for later preview blocks', async () => {
    const { view, node } = mount({}, 'embedded')
    const createPreview = () => {
      const preview = new LivePreviewNodeView({
        node,
        view,
        getPos: () => 0,
        defaultMode: 'preview',
        codemirrorOptions: { lineWrapping: false },
        renderer: {
          languageName: '',
          displayName: 'Test',
          className: 'mf-test-preview',
          getCodeMirrorExtensions: () => [minimalSetup],
          render: (content, container) => {
            container.textContent = content
          },
        },
      })
      cleanups.push(() => preview.destroy())
      return preview
    }
    const preview = createPreview()
    expect(preview.dom.dataset.mode).toBe('preview')
    updateCodemirrorSettings(view, { lineWrapping: true, lineNumbers: 'off', indentSize: 8 })
    await updated()
    preview.editSource()
    expect(preview.dom.dataset.mode).toBe('split')
    expect(preview.dom.querySelector('.cm-content')?.classList.contains('cm-lineWrapping')).toBe(
      true,
    )
    expect(preview.dom.querySelector('.cm-lineNumbers')).toBeNull()
    const later = createPreview()
    later.editSource()
    expect(later.dom.querySelector('.cm-content')?.classList.contains('cm-lineWrapping')).toBe(true)
    expect(later.dom.querySelector('.cm-lineNumbers')).toBeNull()
  })

  it('drops queued composition settings when destroyed', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 0),
    )
    const { source } = mount()
    vi.spyOn(source.cm, 'composing', 'get').mockReturnValue(true)
    source.updateSettings({ lineNumbers: 'off' })
    source.cm.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    source.destroy()
    await vi.advanceTimersByTimeAsync(100)
    expect(source.isDestroyed).toBe(true)
  })

  it('supports boolean compatibility, explicit Frontmatter numbers and trailing whitespace', async () => {
    const { source } = mount({ lineNumbers: true, whitespace: 'trailing' }, 'frontmatter')
    expect(source.cm.dom.querySelector('.cm-lineNumbers')).not.toBeNull()
    expect(source.cm.dom.querySelector('.cm-trailingSpace')).not.toBeNull()
    expect(source.cm.dom.querySelector('.cm-highlightTab')).toBeNull()
    source.updateSettings({ lineNumbers: false })
    await updated()
    expect(source.cm.dom.querySelector('.cm-lineNumbers')).toBeNull()
    expect(source.cm.dom.querySelector('.cm-trailingSpace')).toBeNull()
  })
})
