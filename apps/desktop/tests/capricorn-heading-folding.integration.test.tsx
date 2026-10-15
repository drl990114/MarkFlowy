// Load the verified package before component-opening deadlines.
import 'virtual:markflowy-capricorn-runtime'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import i18n, { changeLng, i18nInit } from '@/i18n'
import {
  CapricornEditor,
  type CapricornEditorHandle,
} from '@/components/EditorArea/CapricornEditor'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  createCapricornRuntimeAdapter,
  type CapricornLocalizationAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'

// Match TextEditor's production bridge, including the legacy cn language code
// and languageChanged subscription, instead of relying on runtime fallbacks.
const localization: CapricornLocalizationAdapter = {
  getDirection: () => (i18n.dir() === 'rtl' ? 'rtl' : 'ltr'),
  getLocale: () => i18n.resolvedLanguage || i18n.language || 'en',
  subscribe(listener) {
    i18n.on('languageChanged', listener)
    return () => i18n.off('languageChanged', listener)
  },
  translate: ({ defaultValue, key, values }) =>
    i18n.t(`capricorn.${key}`, { defaultValue, ...values }),
}

const source = [
  '# Root',
  'Intro',
  '## Child',
  'Child body',
  '### Grandchild',
  'Deep body',
  '# Next',
  'Next body',
].join('\n\n')
let adapter: CapricornRuntimeAdapter | undefined

afterEach(async () => {
  cleanup()
  await act(async () => adapter?.destroy())
  adapter = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function heading(container: HTMLElement, title: string) {
  return [...container.querySelectorAll<HTMLElement>('h1, h2, h3')].find(
    (element) => element.textContent?.trim() === title,
  )
}

function foldControl(container: HTMLElement, title: string) {
  const element = heading(container, title)
  expect(element).toBeDefined()
  return within(element!).getByRole('button')
}

function visible(element: HTMLElement | undefined) {
  if (!element?.isConnected) return false
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current)
    if (current.hidden || style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

async function toggle(container: HTMLElement, title: string, expanded: boolean) {
  await act(async () => fireEvent.click(foldControl(container, title)))
  await waitFor(() =>
    expect(foldControl(container, title).getAttribute('aria-expanded')).toBe(String(expanded)),
  )
}

async function mountAdapter() {
  await i18nInit({ lng: 'en' })
  const container = document.createElement('div')
  document.body.append(container)
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 40, 800, 600))
  const onChange = vi.fn()
  const onError = vi.fn()
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      onChange,
      options: {
        markdown: source,
        autoFocus: false,
        localization,
        virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
        onError,
      },
    })
  })
  onChange.mockClear()
  return { container, runtime: adapter!, onChange, onError }
}

describe.skipIf(!isCapricornRuntimeAvailable)('Capricorn heading folding in MarkFlowy', () => {
  it('hot-switches cn labels without remounting, dirtying content or adding undo history', async () => {
    await i18nInit({ lng: 'cn' })
    expect(i18n.resolvedLanguage).toBe('cn')
    const ref = createRef<CapricornEditorHandle>()
    const onChange = vi.fn()
    const onError = vi.fn()
    const onEditorChange = vi.fn()
    const { container } = render(
      <CapricornEditor
        ref={ref}
        active
        autoFocus={false}
        initialMarkdown={source}
        onChange={onChange}
        onError={onError}
        onUnavailable={onError}
        onEditorChange={onEditorChange}
        options={{ localization, virtualize: { enable: false } }}
      />,
    )
    const button = await waitFor(() => {
      const control = foldControl(container, 'Root')
      expect(control.getAttribute('aria-label')).toBe('折叠章节')
      return control
    })
    const runtime = onEditorChange.mock.calls.find(
      ([value]) => value,
    )?.[0] as CapricornRuntimeAdapter
    const editorRoot = container.querySelector('[data-cap-editable]')
    onChange.mockClear()
    await toggle(container, 'Root', false)
    expect(button.getAttribute('aria-label')).toBe('展开章节')
    expect(runtime.getMarkdown()).toBe(source)
    expect(runtime.getUiState().canUndo).toBe(false)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))

    await act(async () => changeLng('en'))
    await waitFor(() => expect(button.getAttribute('aria-label')).toBe('Expand section'))
    expect(foldControl(container, 'Root')).toBe(button)
    await toggle(container, 'Root', true)
    await act(async () => changeLng('cn'))
    await waitFor(() => expect(button.getAttribute('aria-label')).toBe('折叠章节'))
    expect(container.querySelector('[data-cap-editable]')).toBe(editorRoot)
    expect(onEditorChange.mock.calls.filter(([value]) => value)).toHaveLength(1)
    expect(ref.current!.getMarkdown()).toBe(source)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))

    // Invalidate the host's initial Markdown cache with a real edit before
    // checking that folding preserves serialized content and undo ownership.
    await act(async () => {
      runtime.find.search({ query: 'Intro' })
      expect(runtime.find.replaceAll('Edited intro')).toBe(1)
      runtime.find.close()
    })
    const edited = source.replace('Intro', 'Edited intro')
    expect(runtime.getMarkdown()).toBe(edited)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    onChange.mockClear()
    await toggle(container, 'Root', false)
    await toggle(container, 'Root', true)
    expect(runtime.getMarkdown()).toBe(edited)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    await act(async () => runtime.commands.undo())
    expect(runtime.getMarkdown()).toBe(source)
    await toggle(container, 'Root', false)
    await toggle(container, 'Root', true)
    expect(runtime.getUiState().canRedo).toBe(true)
    await act(async () => runtime.commands.redo())
    expect(runtime.getMarkdown()).toBe(edited)
    expect(onError).not.toHaveBeenCalled()
  })

  it('retains the outline and reveals folded ancestors through host heading, anchor and find navigation', async () => {
    const { container, runtime, onChange, onError } = await mountAdapter()
    const headings = runtime.headings.getAll()
    const target = headings.find((item) => item.text === 'Grandchild')!
    expect(target).toBeDefined()
    for (const navigate of [
      () => runtime.headings.jumpTo(target.id, { offset: 100 }),
      () => runtime.headings.jumpToAnchor!(`#${target.anchor}`),
      () => {
        expect(runtime.find.search({ query: 'Deep body' }).matches).toHaveLength(1)
        return runtime.find.navigateTo!(0)
      },
    ]) {
      await toggle(container, 'Child', false)
      await toggle(container, 'Root', false)
      expect(visible(heading(container, 'Grandchild'))).toBe(false)
      expect(runtime.headings.getAll()).toEqual(headings)
      // Finish the synchronous event before awaiting navigation so React can
      // commit the reveal before the runtime measures its target.
      let navigation: Promise<unknown> | undefined
      act(() => {
        navigation = navigate()
      })
      await act(async () => expect(await navigation).toBeTruthy())
      await waitFor(() => expect(visible(heading(container, 'Grandchild'))).toBe(true))
      expect(foldControl(container, 'Root').getAttribute('aria-expanded')).toBe('true')
      expect(foldControl(container, 'Child').getAttribute('aria-expanded')).toBe('true')
      await act(async () => runtime.find.close())
    }
    expect(runtime.getMarkdown()).toBe(source)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    expect(onError).not.toHaveBeenCalled()
  })

  it('resets folding on host document replacement without reporting a local edit', async () => {
    const { container, runtime, onChange, onError } = await mountAdapter()
    await toggle(container, 'Child', false)
    await toggle(container, 'Root', false)
    const replacement = '# Root\n\nReplacement body\n\n## Child\n\nNew child body'
    await act(async () => runtime.setMarkdown(replacement))
    await waitFor(() =>
      expect(foldControl(container, 'Root').getAttribute('aria-expanded')).toBe('true'),
    )
    expect(foldControl(container, 'Child').getAttribute('aria-expanded')).toBe('true')
    expect(visible(heading(container, 'Child'))).toBe(true)
    expect(runtime.getMarkdown()).toBe(replacement)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    expect(onError).not.toHaveBeenCalled()
  })
})
