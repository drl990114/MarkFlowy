// Load the verified package before component-opening deadlines.
import 'virtual:markflowy-capricorn-runtime'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import i18n, { changeLng, i18nInit } from '@/i18n'
import {
  CapricornEditor,
  type CapricornEditorHandle,
} from '@/components/EditorArea/CapricornEditor'
import type {
  CapricornLocalizationAdapter,
  CapricornRuntimeAdapter,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS } from '@/components/EditorArea/capricornRuntimeAdapter'

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

afterEach(() => {
  cleanup()
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

async function toggle(container: HTMLElement, title: string, expanded: boolean) {
  await act(async () => fireEvent.click(foldControl(container, title)))
  await waitFor(() =>
    expect(foldControl(container, title).getAttribute('aria-expanded')).toBe(String(expanded)),
  )
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
    expect(onError).not.toHaveBeenCalled()
  })

  it('reveals a folded offscreen heading while keeping a long document virtualized', async () => {
    await i18nInit({ lng: 'en' })
    const paragraphs = (start: number) =>
      Array.from({ length: 600 }, (_, index) => `Paragraph ${start + index}`)
    const markdown = [
      '# Root',
      ...paragraphs(0),
      '## Child',
      ...paragraphs(600),
      '# Next',
      'Last body',
    ].join('\n\n')
    const scrollRoot = document.createElement('div')
    document.body.append(scrollRoot)
    Object.defineProperties(scrollRoot, {
      clientHeight: { value: 800 },
      clientWidth: { value: 1000 },
    })
    scrollRoot.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 800)
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-cap-leaf-block')
        ? new DOMRect(0, 0, 1000, 40)
        : originalRect.call(this)
    })
    const onChange = vi.fn()
    const onError = vi.fn()
    const onEditorChange = vi.fn()
    const { container } = render(
      <CapricornEditor
        active
        autoFocus={false}
        initialMarkdown={markdown}
        onChange={onChange}
        onError={onError}
        onUnavailable={onError}
        onEditorChange={onEditorChange}
        options={{
          localization,
          getScrollableContainer: () => scrollRoot,
          virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
        }}
      />,
      { container: scrollRoot },
    )
    await waitFor(() => expect(heading(container, 'Root')).toBeDefined())
    const runtime = onEditorChange.mock.calls.find(
      ([value]) => value,
    )?.[0] as CapricornRuntimeAdapter
    const editorRoot = container.querySelector('[data-cap-editable]')
    const child = runtime.headings.getAll().find((entry) => entry.text === 'Child')!
    expect(child).toBeDefined()
    expect(heading(container, 'Child')).toBeUndefined()
    onChange.mockClear()
    await toggle(container, 'Root', false)
    await waitFor(() => expect(heading(container, 'Next')).toBeDefined())
    expect(container.querySelectorAll('[data-cap-leaf-block]').length).toBeLessThan(10)
    await act(async () => expect(await runtime.headings.jumpTo(child.id)).toBe(true))
    await waitFor(() => expect(heading(container, 'Child')).toBeDefined())
    expect(container.querySelectorAll('[data-cap-leaf-block]').length).toBeLessThan(300)
    expect(container.querySelector('[data-cap-editable]')).toBe(editorRoot)
    expect(runtime.getMarkdown()).toBe(markdown)
    expect(runtime.getUiState().canUndo).toBe(false)
    expect(onChange.mock.calls.some(([change]) => change.documentChanged)).toBe(false)
    expect(onEditorChange.mock.calls.filter(([value]) => value)).toHaveLength(1)
    expect(onError).not.toHaveBeenCalled()
  }, 30000)
})
