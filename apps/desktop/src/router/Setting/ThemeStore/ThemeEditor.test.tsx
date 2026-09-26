import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseThemeDocument } from '@markflowy/theme/semantic'
import { changeLng, i18nInit } from '../../../../../../packages/i18n/src/desktop'
vi.mock('@/i18n', async () => import('../../../../../../packages/i18n/src/desktop'))
vi.mock('@/themes/library', () => ({
  useThemeLibrary: (selector: (state: { snippets: [] }) => unknown) => selector({ snippets: [] }),
}))
vi.mock('./ThemePreview', () => ({
  ThemePreview: ({ onInspect }: { onInspect: (name: string) => void }) => (
    <>
      <button onClick={() => onInspect('editor.caret')}>Inspect caret</button>
      <button onClick={() => onInspect('editor.background')}>Inspect background</button>
    </>
  ),
}))
import { ThemeEditor } from './ThemeEditor'
import { readThemeDrafts, themeDraftKey } from './drafts'
const initial = () =>
  parseThemeDocument({
    version: 1,
    id: 'paper',
    name: 'Paper',
    variants: [{ id: 'light', name: 'Light', mode: 'light', tokens: {} }],
  })
const save = vi.fn(async () => true)
beforeEach(async () => {
  await i18nInit({ lng: 'en' })
  vi.clearAllMocks()
  sessionStorage.clear()
})
afterEach(cleanup)
function mount() {
  return render(
    <ThemeEditor initial={initial()} onSave={save} onClose={vi.fn()} onExport={vi.fn()} />,
  )
}
describe('theme editor draft workflow', () => {
  it('translates the open editor without resetting the theme draft', async () => {
    mount()
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Paper draft' },
    })

    await act(async () => {
      await changeLng('cn')
    })

    expect((screen.getByRole('textbox', { name: '名称' }) as HTMLInputElement).value).toBe(
      'Paper draft',
    )
    expect(screen.getByRole('button', { name: '保存并应用' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: '查找 token…' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '添加深色变体' }))
    expect((screen.getByRole('textbox', { name: '变体' }) as HTMLInputElement).value).toBe(
      'Paper draft 深色',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('locates an inspected role and lets a value be changed and undone', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Inspect caret' }))
    const input = screen.getByRole('textbox', { name: 'Value' }) as HTMLInputElement
    expect(input.value).toBe('#202020ff')
    fireEvent.change(input, { target: { value: '#123456' } })
    fireEvent.blur(input)
    expect((screen.getByRole('textbox', { name: 'Value' }) as HTMLInputElement).value).toBe(
      '#123456ff',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect((screen.getByRole('textbox', { name: 'Value' }) as HTMLInputElement).value).toBe(
      '#202020ff',
    )
  })
  it('keeps invalid JSON visible and prevents silently saving the last valid draft', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Advanced JSON / CSS' }))
    const input = screen.getByRole('textbox', { name: 'Theme JSON' })
    fireEvent.change(input, { target: { value: '{invalid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update from JSON' }))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect((input as HTMLTextAreaElement).value).toBe('{invalid')
    expect(
      (screen.getByRole('button', { name: 'Save and apply' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })
  it('autosaves a window-local draft without committing the theme library', async () => {
    mount()
    await waitFor(() => expect(sessionStorage.getItem(themeDraftKey('paper'))).toContain('paper'))
    expect(save).not.toHaveBeenCalled()
  })
  it('retains the latest name when closing before the debounce expires', () => {
    const view = mount()
    const input = screen.getByRole('textbox', { name: 'Name' })
    fireEvent.change(input, { target: { value: 'Paper ' } })
    fireEvent.change(input, { target: { value: 'Paper Moon' } })
    view.unmount()
    expect(JSON.parse(sessionStorage.getItem(themeDraftKey('paper'))!).document.name).toBe(
      'Paper Moon',
    )
    expect(save).not.toHaveBeenCalled()
  })
})

describe('theme authoring sessions', () => {
  it('preserves raw invalid JSON across close and recovery', () => {
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Advanced JSON / CSS' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Theme JSON' }), {
      target: { value: '{"name": "unfinished' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    view.unmount()
    const [draft] = readThemeDrafts()
    expect(draft.session.json).toBe('{"name": "unfinished')
    render(
      <ThemeEditor
        initial={draft.session.document}
        initialVariantId={draft.session.variantId}
        initialJson={draft.session.json}
        onSave={save}
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    )
    expect((screen.getByRole('textbox', { name: 'Theme JSON' }) as HTMLTextAreaElement).value).toBe(
      '{"name": "unfinished',
    )
    expect(
      (screen.getByRole('button', { name: 'Save and apply' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
  it('keeps different theme drafts independently', () => {
    const first = mount()
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'My Paper' },
    })
    first.unmount()
    const second = render(
      <ThemeEditor
        initial={{ ...initial(), id: 'ink', name: 'Ink' }}
        onSave={save}
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    )
    second.unmount()
    expect(
      readThemeDrafts()
        .map((draft) => draft.session.document.name)
        .sort(),
    ).toEqual(['Ink', 'My Paper'])
  })
  it('blocks competing visual changes and export until JSON is applied or discarded', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Advanced JSON / CSS' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Theme JSON' }), {
      target: { value: '{' },
    })
    expect(screen.getByRole('textbox', { name: 'Name' }).closest('fieldset')?.disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Export JSON' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Discard JSON edits' }))
    expect(screen.getByRole('textbox', { name: 'Name' }).closest('fieldset')?.disabled).toBe(false)
    expect(
      (screen.getByRole('button', { name: 'Export JSON' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(
      JSON.parse((screen.getByRole('textbox', { name: 'Theme JSON' }) as HTMLTextAreaElement).value)
        .id,
    ).toBe('paper')
  })
  it('edits and applies the chosen dark variant and retains that choice in its draft', async () => {
    const document = initial()
    document.variants.push({ id: 'night', name: 'Night', mode: 'dark', tokens: {} })
    render(
      <ThemeEditor
        initial={document}
        initialVariantId='night'
        onSave={save}
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    )
    expect((screen.getByRole('textbox', { name: 'Variant' }) as HTMLInputElement).value).toBe(
      'Night',
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Variant' }), {
      target: { value: 'Midnight' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and apply' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          variants: [
            expect.objectContaining({ name: 'Light' }),
            expect.objectContaining({ name: 'Midnight' }),
          ],
        }),
        'night',
      ),
    )
  })
})

describe('token editing preserves inheritance', () => {
  it('leaves a default token inherited after focus and blur', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Inspect background' }))
    const input = screen.getByRole('textbox', { name: 'Value' })
    fireEvent.focus(input)
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole('button', { name: 'Save and apply' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          variants: [expect.objectContaining({ tokens: {} })],
        }),
        'light',
      ),
    )
  })
  it('keeps an explicit reference when its displayed value is unchanged', async () => {
    const document = initial()
    document.variants[0].tokens['editor.caret'] = { ref: 'accent.background' }
    render(<ThemeEditor initial={document} onSave={save} onClose={vi.fn()} onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inspect caret' }))
    const input = screen.getByRole('textbox', { name: 'Value' })
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole('button', { name: 'Save and apply' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          variants: [
            expect.objectContaining({ tokens: { 'editor.caret': { ref: 'accent.background' } } }),
          ],
        }),
        'light',
      ),
    )
  })
})

describe('invalid token drafts', () => {
  const enterInvalid = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Inspect caret' }))
    const input = screen.getByRole('textbox', { name: 'Value' })
    fireEvent.change(input, { target: { value: 'nonsense' } })
    fireEvent.blur(input)
    return input
  }
  it('does not save or export the old value while an invalid value remains visible', () => {
    mount()
    const input = enterInvalid()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(
      (screen.getByRole('button', { name: 'Save and apply' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Export JSON' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save and apply' }))
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '#123456' } })
    fireEvent.blur(input)
    expect(
      (screen.getByRole('button', { name: 'Save and apply' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it.each(['reset', 'switch', 'undo'] as const)(
    'can recover from invalid input with %s',
    (action) => {
      mount()
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: 'Edited Paper' },
      })
      enterInvalid()
      fireEvent.click(
        screen.getByRole('button', {
          name: action === 'reset' ? 'Reset' : action === 'switch' ? 'Inspect background' : 'Undo',
        }),
      )
      expect((screen.getByRole('textbox', { name: 'Value' }) as HTMLInputElement).value).not.toBe(
        'nonsense',
      )
      expect(
        (screen.getByRole('button', { name: 'Save and apply' }) as HTMLButtonElement).disabled,
      ).toBe(false)
      expect(
        (screen.getByRole('button', { name: 'Export JSON' }) as HTMLButtonElement).disabled,
      ).toBe(false)
      expect(screen.queryByRole('alert')).toBeNull()
    },
  )
  it('can restore the original value without creating an override', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Inspect caret' }))
    const original = (screen.getByRole('textbox', { name: 'Value' }) as HTMLInputElement).value
    const input = enterInvalid()
    fireEvent.change(input, { target: { value: original } })
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole('button', { name: 'Save and apply' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          variants: [expect.objectContaining({ tokens: {} })],
        }),
        'light',
      ),
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
