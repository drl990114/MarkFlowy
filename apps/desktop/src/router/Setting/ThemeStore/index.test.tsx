import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changeLng, i18nInit } from '../../../../../../packages/i18n/src/desktop'
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  reload: vi.fn(),
  open: vi.fn(),
  read: vi.fn(),
  confirm: vi.fn(),
}))
vi.mock('@/i18n', async () => import('../../../../../../packages/i18n/src/desktop'))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open, save: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: mocks.read, writeTextFile: vi.fn() }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: mocks.confirm } }))
vi.mock('./ThemePreview', () => ({ ThemePreview: () => <div>Preview</div> }))
vi.mock('@/themes/library', async () => {
  const { create } = await import('zustand')
  return {
    useThemeLibrary: create(() => ({
      revision: 1,
      loaded: true,
      documents: [],
      snippets: [{ id: 'paper', name: 'Paper CSS', css: 'body{}', enabled: true }],
      mutate: mocks.mutate,
      reload: mocks.reload,
    })),
  }
})
vi.mock('@/stores/useThemeStore', async () => {
  const { create } = await import('zustand')
  const { lightTheme } = await import('@markflowy/theme')
  return { default: create(() => ({ themes: [lightTheme], curTheme: lightTheme })) }
})
import { ThemeStore } from './index'
beforeEach(async () => {
  await i18nInit({ lng: 'en' })
  vi.clearAllMocks()
  sessionStorage.clear()
  mocks.mutate.mockResolvedValue(undefined)
})
afterEach(cleanup)
describe('declarative theme manager', () => {
  it.each([
    ['en', 'Create theme', 'Personal CSS snippets', 'Light'],
    ['cn', '创建主题', '个人 CSS 片段', '浅色'],
    ['frFR', 'Créer un thème', 'Extraits CSS personnels', 'Clair'],
    ['es', 'Crear tema', 'Fragmentos CSS personales', 'Claro'],
    ['ja', 'テーマを作成', '個人用 CSS スニペット', 'ライト'],
  ] as const)(
    'renders theme controls in the app language %s',
    async (language, create, snippets, mode) => {
      await changeLng(language)
      render(<ThemeStore />)

      expect(screen.getByRole('button', { name: create })).toBeTruthy()
      expect(screen.getByRole('heading', { name: snippets })).toBeTruthy()
      expect(screen.getByText(`· ${mode}`)).toBeTruthy()
    },
  )

  it('updates mounted controls when the language changes without losing a CSS draft', async () => {
    render(<ThemeStore />)
    fireEvent.click(screen.getByRole('button', { name: 'New snippet' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'My CSS draft' },
    })

    await act(async () => {
      await changeLng('cn')
    })

    expect(screen.getByRole('button', { name: '创建主题' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: '使用个人字体、字号与行高' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: '名称' }) as HTMLInputElement).value).toBe(
      'My CSS draft',
    )
    expect(screen.getByRole('button', { name: '保存片段' })).toBeTruthy()
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it('imports disabled CSS without executing any theme script', async () => {
    mocks.open.mockResolvedValue('/paper.css')
    mocks.read.mockResolvedValue('body{font-size:15px}')
    render(<ThemeStore />)
    fireEvent.click(screen.getByRole('button', { name: 'Import CSS' }))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({
        type: 'saveSnippet',
        snippet: expect.objectContaining({ css: 'body{font-size:15px}', enabled: false }),
      }),
    )
  })
  it('disables all snippets in one native mutation', async () => {
    render(<ThemeStore />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable all' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ type: 'disableSnippets' }))
  })
  it('retains snippet and surfaces failed persistence', async () => {
    mocks.mutate.mockRejectedValue(new Error('disk full'))
    render(<ThemeStore />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect((await screen.findByRole('alert')).textContent).toContain('disk full')
    expect(screen.getByText('Paper CSS')).toBeTruthy()
  })
  it('rejects malformed JSON before saving', async () => {
    mocks.open.mockResolvedValue('/theme.json')
    mocks.read.mockResolvedValue('{"version":0}')
    render(<ThemeStore />)
    fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }))
    await screen.findByRole('alert')
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('creates an isolated editable copy and can close without applying it', async () => {
    render(<ThemeStore />)
    fireEvent.click(screen.getByRole('button', { name: 'Create theme' }))
    expect(screen.getByText('Preview')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
})
