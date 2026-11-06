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
})
