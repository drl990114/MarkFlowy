import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { darkTheme, lightTheme } from '@markflowy/theme'
import type { ThemeDocument } from '@markflowy/theme/semantic'
import useThemeStore from '@/stores/useThemeStore'
import { useThemeLibrary } from '@/themes/library'
import { toAppTheme } from '@/themes/runtime'
import { changeLng, i18nInit } from '../../../../../../packages/i18n/src/desktop'
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  reload: vi.fn(),
  open: vi.fn(),
  read: vi.fn(),
  confirm: vi.fn(),
  fetch: vi.fn(),
  apply: vi.fn(),
  save: vi.fn(),
  write: vi.fn(),
  openUrl: vi.fn(),
}))
vi.mock('@/i18n', async () => import('../../../../../../packages/i18n/src/desktop'))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open, save: mocks.save }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: mocks.read, writeTextFile: mocks.write }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: mocks.fetch }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }))
vi.mock('../../../../../../community-themes.json', () => ({
  default: [
    {
      id: 'ocean',
      name: 'Ocean',
      author: 'Mina',
      version: '2.0.0',
      url: 'https://example.com/ocean.json',
    },
  ],
}))
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
  const { lightTheme: initialTheme } = await import('@markflowy/theme')
  return {
    default: create(() => ({
      themes: [initialTheme],
      curTheme: initialTheme,
      applyThemeSelection: mocks.apply,
    })),
  }
})
import { ThemeStore, type ThemeStoreProps } from './index'
import { ThemeCustomization } from './ThemeCustomization'

const ocean: ThemeDocument = {
  version: 1,
  id: 'ocean',
  name: 'Ocean',
  author: 'Mina',
  variants: [{ id: 'night', name: 'Night', mode: 'dark', tokens: {} }],
}
const personal: ThemeDocument = {
  version: 1,
  id: 'personal-paper',
  name: 'Paper',
  author: 'Lin',
  variants: [{ id: 'light', name: 'Paper', mode: 'light', tokens: {} }],
}

let queryClient: QueryClient
function renderStore(props: ThemeStoreProps = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeStore {...props} />
      <ThemeCustomization />
    </QueryClientProvider>,
  )
}

async function openMenu(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'ArrowDown' })
  return screen.findByRole('menu')
}

function openCustomization() {
  fireEvent.click(screen.getByText('Typography & CSS'))
}

beforeEach(async () => {
  await i18nInit({ lng: 'en' })
  vi.resetAllMocks()
  queryClient = new QueryClient()
  sessionStorage.clear()
  mocks.mutate.mockResolvedValue(undefined)
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ocean })
  useThemeLibrary.setState({
    documents: [],
    snippets: [{ id: 'paper', name: 'Paper CSS', css: 'body{}', enabled: true }],
    loaded: true,
    error: undefined,
  })
  useThemeStore.setState({
    themes: [lightTheme, darkTheme],
    curTheme: lightTheme,
    lightThemeName: lightTheme.name,
    darkThemeName: 'not-selected',
    themeMode: 'system',
    systemTheme: 'light',
  })
  mocks.apply.mockImplementation(async (selection) => {
    useThemeStore.setState(selection)
  })
})
afterEach(() => {
  cleanup()
  queryClient.clear()
})
describe('declarative theme manager', () => {
  it.each([
    ['en', 'Create theme', 'Theme tools', 'Typography & CSS', 'Personal CSS snippets', 'Light'],
    ['cn', '创建主题', '主题工具', '字体与 CSS', '个人 CSS 片段', '浅色'],
    [
      'frFR',
      'Créer un thème',
      'Outils de thème',
      'Typographie et CSS',
      'Extraits CSS personnels',
      'Clair',
    ],
    [
      'es',
      'Crear tema',
      'Herramientas de temas',
      'Tipografía y CSS',
      'Fragmentos CSS personales',
      'Claro',
    ],
    ['ja', 'テーマを作成', 'テーマツール', 'フォントと CSS', '個人用 CSS スニペット', 'ライト'],
  ] as const)(
    'renders theme controls in the app language %s',
    async (language, create, tools, customization, snippets, mode) => {
      await changeLng(language)
      renderStore()

      fireEvent.click(screen.getByText(customization))
      expect(screen.getByRole('heading', { name: snippets })).toBeTruthy()
      expect(screen.getByText(mode)).toBeTruthy()
      await openMenu(tools)
      expect(screen.getByRole('menuitem', { name: create })).toBeTruthy()
    },
  )

  it('updates mounted controls when the language changes without losing a CSS draft', async () => {
    renderStore()
    openCustomization()
    fireEvent.click(screen.getByRole('button', { name: 'New snippet' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'My CSS draft' },
    })

    await act(async () => {
      await changeLng('cn')
    })

    expect(screen.getByRole('button', { name: '主题工具' })).toBeTruthy()
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
    renderStore()
    openCustomization()
    await openMenu('More actions: Personal CSS snippets')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import CSS' }))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({
        type: 'saveSnippet',
        snippet: expect.objectContaining({ css: 'body{font-size:15px}', enabled: false }),
      }),
    )
  })
  it('disables all snippets in one native mutation', async () => {
    renderStore()
    openCustomization()
    await openMenu('More actions: Personal CSS snippets')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Disable all' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ type: 'disableSnippets' }))
  })
  it('retains snippet and surfaces failed persistence', async () => {
    mocks.mutate.mockRejectedValue(new Error('disk full'))
    renderStore()
    openCustomization()
    await openMenu('More actions: Paper CSS')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }))
    expect((await screen.findByRole('alert')).textContent).toContain('disk full')
    expect(screen.getByText('Paper CSS')).toBeTruthy()
  })
  it('rejects malformed JSON before saving', async () => {
    mocks.open.mockResolvedValue('/theme.json')
    mocks.read.mockResolvedValue('{"version":0}')
    renderStore()
    await openMenu('Theme tools')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import JSON' }))
    await screen.findByRole('alert')
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('creates an isolated editable copy and can close without applying it', async () => {
    renderStore()
    await openMenu('Theme tools')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create theme' }))
    expect(screen.getByText('Preview')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it('separates built-in, catalog and local themes without attributing imports to the user', () => {
    const imported = { ...personal, id: 'imported', name: 'Imported', author: undefined }
    const documents = [ocean, personal, imported]
    useThemeLibrary.setState({ documents })
    useThemeStore.setState({
      themes: [lightTheme, ...documents.map((item) => toAppTheme(item, item.variants[0]))],
    })
    renderStore()

    const builtIn = within(screen.getByRole('region', { name: 'Built-in themes' }))
    expect(builtIn.getAllByRole('article')).toHaveLength(1)
    expect(builtIn.getByRole('article', { name: 'MarkFlowy Light' })).toBeTruthy()
    const community = within(screen.getByRole('region', { name: 'Community themes' }))
    expect(community.getAllByRole('article')).toHaveLength(1)
    expect(community.getByText('Author: Mina')).toBeTruthy()
    expect(community.getByText('Installed')).toBeTruthy()
    expect(community.queryByRole('button', { name: 'Install' })).toBeNull()
    const local = within(screen.getByRole('region', { name: 'Local themes' }))
    expect(local.getAllByRole('article')).toHaveLength(2)
    expect(local.getByText('Author: Lin')).toBeTruthy()
    expect(local.getByText('Author not specified')).toBeTruthy()
  })

  it('keeps the current theme visible and applies another theme with one action', async () => {
    renderStore()
    const light = screen.getByRole('article', { name: 'MarkFlowy Light' })
    expect(light.getAttribute('aria-current')).toBe('true')
    expect(within(light).queryByRole('button', { name: /Set as .* theme/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy and edit' })).toBeNull()
    expect(screen.getByText('Typography & CSS').closest('details')?.open).toBe(false)

    const dark = screen.getByRole('article', { name: 'MarkFlowy Dark' })
    fireEvent.click(within(dark).getByRole('button', { name: /Set as .* theme/ }))
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith({
        darkThemeName: darkTheme.name,
      }),
    )
    expect(dark.getAttribute('aria-current')).toBeNull()
    expect(within(dark).getByText('Selected')).toBeTruthy()
    expect(useThemeStore.getState().themeMode).toBe('system')
  })

  it('opens secondary actions by keyboard and restores focus after Escape', async () => {
    renderStore()
    const trigger = screen.getByRole('button', { name: 'More actions: MarkFlowy Light' })
    trigger.focus()
    const menu = await openMenu('More actions: MarkFlowy Light')
    expect(menu.hasAttribute('data-mf-portal')).toBe(true)
    expect(screen.getByRole('menuitem', { name: 'Copy and edit' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).toBeNull()
    fireEvent.keyDown(menu, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('installs a catalog theme once, then exposes its installed variants for applying', async () => {
    const download: ThemeDocument = {
      ...ocean,
      variants: [...ocean.variants, { id: 'day', name: 'Day', mode: 'light', tokens: {} }],
    }
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => download })
    mocks.mutate.mockImplementation(async () => {
      useThemeLibrary.setState({ documents: [download] })
      useThemeStore.setState({
        themes: [lightTheme, ...download.variants.map((variant) => toAppTheme(download, variant))],
      })
    })
    renderStore()
    expect(screen.getByText('Author: Mina · v2.0.0')).toBeTruthy()
    await waitFor(() =>
      expect(
        screen.getByRole('article', { name: 'Ocean' }).querySelector('[data-slot="theme-palette"]'),
      ).not.toBeNull(),
    )
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(useThemeLibrary.getState().documents).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({
        type: 'save',
        document: download,
        replace: false,
      }),
    )
    const community = within(screen.getByRole('region', { name: 'Community themes' }))
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(community.getAllByRole('article')).toHaveLength(2)
    expect(community.queryByRole('button', { name: 'Install' })).toBeNull()
    fireEvent.click(
      within(community.getByRole('article', { name: 'Ocean · Night' })).getByRole('button', {
        name: /Set as .* theme/,
      }),
    )
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledWith({ darkThemeName: 'ocean/night' }))
    fireEvent.click(
      within(community.getByRole('article', { name: 'Ocean · Day' })).getByRole('button', {
        name: /Set as .* theme/,
      }),
    )
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenLastCalledWith({
        lightThemeName: 'ocean/day',
      }),
    )
  })

  it('keeps reinstallation behind the existing replace confirmation', async () => {
    useThemeLibrary.setState({ documents: [ocean] })
    useThemeStore.setState({ themes: [lightTheme, toAppTheme(ocean, ocean.variants[0])] })
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ocean })
    mocks.confirm.mockResolvedValue('cancel')
    renderStore()
    await openMenu('More actions: Ocean · Night')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reinstall' }))
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    expect(mocks.mutate).not.toHaveBeenCalled()

    mocks.confirm.mockResolvedValue('replace')
    await openMenu('More actions: Ocean · Night')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reinstall' }))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({ type: 'save', document: ocean, replace: true }),
    )
  })

  it.each(['network', 'identity'])(
    'leaves a theme uninstalled after a %s failure',
    async (failure) => {
      mocks.fetch.mockResolvedValue(
        failure === 'network'
          ? { ok: false, status: 503 }
          : { ok: true, json: async () => ({ ...ocean, id: 'unlisted' }) },
      )
      renderStore()
      fireEvent.click(screen.getByRole('button', { name: 'Install' }))
      expect((await screen.findByRole('alert')).textContent).toContain(
        failure === 'network' ? 'HTTP 503' : 'The theme ID does not match the community catalog.',
      )
      expect(mocks.mutate).not.toHaveBeenCalled()
      expect(screen.queryByText('Installed')).toBeNull()
      expect((screen.getByRole('button', { name: 'Install' }) as HTMLButtonElement).disabled).toBe(
        false,
      )
    },
  )

  it('shows a useful empty state for the installed-only community filter', () => {
    renderStore()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Installed only' }))
    expect(screen.getByText('No community themes installed yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Installed only' }))
    expect(screen.getByRole('button', { name: 'Install' })).toBeTruthy()
  })

  it('exports a local document and still confirms its removal from the overflow menu', async () => {
    useThemeLibrary.setState({ documents: [personal] })
    useThemeStore.setState({ themes: [lightTheme, toAppTheme(personal, personal.variants[0])] })
    mocks.save.mockResolvedValue('/paper.json')
    mocks.confirm.mockResolvedValue('cancel')
    renderStore()
    await openMenu('More actions: Paper')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export JSON' }))
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith('/paper.json', JSON.stringify(personal, null, 2)),
    )
    await openMenu('More actions: Paper')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }))
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    expect(mocks.mutate).not.toHaveBeenCalled()
    mocks.confirm.mockResolvedValue('remove')
    await openMenu('More actions: Paper')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({ type: 'remove', id: personal.id }),
    )
  })

  it('keeps submission and schema export available in theme tools', async () => {
    renderStore()
    await openMenu('Theme tools')
    expect(screen.getByRole('menuitem', { name: 'Export JSON Schema' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Submit theme' }))
    await waitFor(() =>
      expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/drl990114/MarkFlowy'),
    )
  })
  it('filters installed themes by the requested mode and returns after a successful selection', async () => {
    const onSelected = vi.fn()
    renderStore({ mode: 'dark', onSelected })
    expect(screen.queryByRole('article', { name: 'MarkFlowy Light' })).toBeNull()
    fireEvent.click(
      within(screen.getByRole('article', { name: 'MarkFlowy Dark' })).getByRole('button', {
        name: 'Set as dark theme',
      }),
    )
    await waitFor(() => expect(onSelected).toHaveBeenCalledTimes(1))
    expect(mocks.apply).toHaveBeenCalledExactlyOnceWith({ darkThemeName: darkTheme.name })
  })

  it('creates a theme for the requested mode and saves it without changing the display mode', async () => {
    renderStore({ mode: 'dark' })
    await openMenu('Theme tools')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create theme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save and apply' }))
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(1))
    expect(mocks.mutate.mock.calls[0][0].document.variants[0].mode).toBe('dark')
    expect(mocks.apply).toHaveBeenCalledWith({
      darkThemeName: expect.stringMatching(/^personal-.*\/dark$/),
    })
    expect(useThemeStore.getState().themeMode).toBe('system')
  })

  it('installs and selects the matching variant while preserving the display mode', async () => {
    const download: ThemeDocument = {
      ...ocean,
      variants: [{ id: 'day', name: 'Day', mode: 'light', tokens: {} }, ...ocean.variants],
    }
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => download })
    const onSelected = vi.fn()
    renderStore({ mode: 'dark', onSelected })
    fireEvent.click(screen.getByRole('button', { name: 'Install and select' }))
    await waitFor(() => expect(onSelected).toHaveBeenCalledTimes(1))
    expect(mocks.apply).toHaveBeenCalledExactlyOnceWith({ darkThemeName: 'ocean/night' })
    expect(mocks.mutate).toHaveBeenCalledWith({ type: 'save', document: download, replace: false })
    expect(useThemeStore.getState().themeMode).toBe('system')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not install or apply an incompatible variant even before its preview loads', async () => {
    const onSelected = vi.fn()
    renderStore({ mode: 'light', onSelected })
    fireEvent.click(screen.getByRole('button', { name: 'Install and select' }))
    expect((await screen.findByRole('alert')).textContent).toContain('No light variant')
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(onSelected).not.toHaveBeenCalled()
  })

  it('stays in the chooser when installation fails', async () => {
    mocks.mutate.mockRejectedValue(new Error('disk full'))
    const onSelected = vi.fn()
    renderStore({ mode: 'dark', onSelected })
    fireEvent.click(screen.getByRole('button', { name: 'Install and select' }))
    expect((await screen.findByRole('alert')).textContent).toContain('disk full')
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(onSelected).not.toHaveBeenCalled()
  })
})
