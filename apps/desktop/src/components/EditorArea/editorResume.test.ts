import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEditorResumeStore, flushEditorResumeStates } from '@/stores/editorResumeStore'
import { bindEditorResume, bindSourceEditorResume } from './editorResume'

const cleanups: (() => void)[] = []
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  document.body.replaceChildren()
  vi.useRealTimers()
})

function surface() {
  const outer = document.createElement('div')
  outer.dataset.editorId = 'test'
  const viewport = document.createElement('div')
  viewport.setAttribute('data-overlayscrollbars-viewport', '')
  const container = document.createElement('div')
  viewport.append(container)
  outer.append(viewport)
  document.body.append(outer)
  return { viewport, container }
}

describe('editor resume lifecycle', () => {
  it('restores source selection and outer scrolling without adding undo or editing text', async () => {
    const { viewport, container } = surface()
    createEditorResumeStore('/note.md', 'main', 'source')
      .getState()
      .save({
        scrollTop: 350,
        scrollLeft: 12,
        selection: { kind: 'source', anchor: 2, head: 50 },
      })
    const view = new EditorView({
      parent: container,
      state: EditorState.create({ doc: 'hello world' }),
    })
    const dispose = bindSourceEditorResume(view, {
      path: '/note.md',
      group: 'main',
      isVisible: () => true,
    })
    cleanups.push(() => {
      dispose()
      view.destroy()
    })
    await vi.advanceTimersByTimeAsync(40)
    expect(view.state.selection.main).toMatchObject({ anchor: 2, head: 11 })
    expect(view.state.doc.toString()).toBe('hello world')
    expect(viewport.scrollTop).toBe(350)
    expect(viewport.scrollLeft).toBe(12)
  })

  it('flushes the last active position even when the editor becomes hidden before debounce finishes', async () => {
    const { viewport, container } = surface()
    const view = new EditorView({ parent: container, state: EditorState.create({ doc: 'abcdef' }) })
    let visible = true
    const dispose = bindSourceEditorResume(view, {
      path: '/flush.md',
      group: 'main',
      isVisible: () => visible,
    })
    cleanups.push(() => {
      dispose()
      view.destroy()
    })
    await vi.advanceTimersByTimeAsync(40)
    viewport.scrollTop = 123
    view.dispatch({ selection: { anchor: 4 } })
    visible = false
    flushEditorResumeStates()
    expect(createEditorResumeStore('/flush.md', 'main', 'source').getState().resume).toMatchObject({
      scrollTop: 123,
      selection: { anchor: 4, head: 4 },
    })
  })

  it('lets a search navigation already in progress take priority over a saved caret', async () => {
    const { viewport, container } = surface()
    createEditorResumeStore('/target.md', 'main', 'source')
      .getState()
      .save({
        scrollTop: 350,
        scrollLeft: 0,
        selection: { kind: 'source', anchor: 1, head: 1 },
      })
    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: 'search result',
        selection: { anchor: 7, head: 13 },
      }),
    })
    viewport.scrollTop = 90
    const dispose = bindSourceEditorResume(view, {
      path: '/target.md',
      group: 'main',
      isVisible: () => true,
      shouldRestore: () => false,
    })
    cleanups.push(() => {
      dispose()
      view.destroy()
    })
    await vi.advanceTimersByTimeAsync(40)
    expect(view.state.selection.main).toMatchObject({ anchor: 7, head: 13 })
    expect(viewport.scrollTop).toBe(90)
  })

  it('cancels restoration when navigation changes the source selection before the first frame', async () => {
    const { viewport, container } = surface()
    createEditorResumeStore('/navigate.md', 'main', 'source')
      .getState()
      .save({
        scrollTop: 400,
        scrollLeft: 0,
        selection: { kind: 'source', anchor: 1, head: 1 },
      })
    const view = new EditorView({ parent: container, state: EditorState.create({ doc: 'abcdef' }) })
    const dispose = bindSourceEditorResume(view, {
      path: '/navigate.md',
      group: 'main',
      isVisible: () => true,
    })
    cleanups.push(() => {
      dispose()
      view.destroy()
    })
    view.dispatch({ selection: { anchor: 5 } })
    viewport.scrollTop = 80
    viewport.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(200)
    expect(view.state.selection.main.anchor).toBe(5)
    expect(viewport.scrollTop).toBe(80)
    expect(
      createEditorResumeStore('/navigate.md', 'main', 'source').getState().resume,
    ).toMatchObject({
      scrollTop: 80,
      selection: { anchor: 5, head: 5 },
    })
  })

  it('never overwrites a user scroll when deferred resources finish loading', async () => {
    const { viewport, container } = surface()
    createEditorResumeStore('/slow.md', '', 'edit')
      .getState()
      .save({ scrollTop: 400, scrollLeft: 0 })
    let finish!: () => void
    const resources = new Promise<void>((resolve) => {
      finish = resolve
    })
    cleanups.push(
      bindEditorResume({
        container,
        path: '/slow.md',
        group: '',
        mode: 'edit',
        isVisible: () => true,
        isComposing: () => false,
        captureSelection: () => undefined,
        restoreSelection: () => {},
        subscribeSelection: () => () => {},
        waitForResources: () => resources,
      }),
    )
    await vi.advanceTimersByTimeAsync(20)
    expect(viewport.scrollTop).toBe(400)
    viewport.dispatchEvent(new Event('wheel'))
    viewport.scrollTop = 90
    viewport.dispatchEvent(new Event('scroll'))
    finish()
    await vi.advanceTimersByTimeAsync(200)
    expect(viewport.scrollTop).toBe(90)
    expect(createEditorResumeStore('/slow.md', '', 'edit').getState().resume?.scrollTop).toBe(90)
  })
})
