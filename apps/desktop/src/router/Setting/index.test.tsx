import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Popover } from '@/components/ui/popover'
import { Select } from '@/components/ui/select'
import type { OpenSettingTarget } from '@/extensions/ai/aiProvidersService'
import Setting from '.'
import FileExcludePatterns from './component/SettingItems/FileExcludePatterns'
import { SettingRouteController, type SettingRouteState } from './component/SettingRouteController'
import { WorkspaceRouteSurface } from './component/WorkspaceRouteSurface'

const state = vi.hoisted(() => ({
  handler: undefined as ((target?: OpenSettingTarget) => void) | undefined,
  checkUpdate: vi.fn().mockResolvedValue(null),
  writeSettingData: vi.fn(),
  mounted: vi.fn(),
  cleanedUp: vi.fn(),
}))

vi.mock('@/commands', () => ({
  commandRegistry: {
    registerCommand: ({ handler }: { handler: typeof state.handler }) => {
      state.handler = handler
      return { dispose: vi.fn() }
    },
  },
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/helper/updater', () => ({ installUpdate: vi.fn() }))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: vi.fn() } }))
vi.mock('@/services/app-setting', () => ({
  appSettingStoreSetup: vi.fn(),
  default: { writeSettingData: state.writeSettingData },
}))
vi.mock('@/stores/useAppInfoStore', () => ({
  default: () => ({ appInfo: { name: 'MarkFlowy', version: '1.0.0' } }),
}))
vi.mock('@/stores/useAppSettingStore', () => ({
  default: () => ({ settingData: { file_exclude_patterns: '**/node_modules/**' } }),
}))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: state.checkUpdate }))
vi.mock('zens', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('./CopilotSetting', () => ({ CopilotSetting: () => null }))
vi.mock('./ExportSetting', () => ({ ExportSetting: () => null }))
vi.mock('./ImageSetting', () => ({ ImageSetting: () => null }))
vi.mock('./KeyboardTable', () => ({ KeyboardTable: () => null }))
vi.mock('./Support', () => ({ Support: () => null }))
vi.mock('./ThemeSetting', () => ({ ThemeSetting: () => null }))
vi.mock('./ThemeStore', () => ({ ThemeStore: () => null }))
vi.mock('./settingMap', () => ({
  getSettingMap: () => ({
    general: { i18nKey: 'General', desc: { i18nKey: 'General settings' }, misc: {} },
    editor: { i18nKey: 'Editor', desc: { i18nKey: 'Editor settings' }, behavior: {} },
    ai: { i18nKey: 'AI', desc: { i18nKey: 'AI settings' }, model: {} },
  }),
}))
vi.mock('./component/SettingGroup', () => ({
  default: ({ categoryKey, activeChildId }: { categoryKey: string; activeChildId?: string }) =>
    categoryKey === 'general' ? (
      <SettingControls />
    ) : (
      <output aria-label='Selected provider'>{activeChildId}</output>
    ),
}))

function SettingControls() {
  return (
    <>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button>Open nested dialog</Button>
        </Dialog.Trigger>
        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>Nested dialog</Dialog.Title>
          <Button>Nested action</Button>
        </Dialog.Content>
      </Dialog.Root>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button>Open popover</Button>
        </Popover.Trigger>
        <Popover.Content>
          <Button>Popover action</Button>
        </Popover.Content>
      </Popover.Root>
      <Select.Root defaultValue='light'>
        <Select.Trigger aria-label='Theme'>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value='light'>Light</Select.Item>
          <Select.Item value='dark'>Dark</Select.Item>
        </Select.Content>
      </Select.Root>
      <FileExcludePatterns
        item={{
          key: 'file_exclude_patterns',
          type: 'file-exclude-patterns',
          title: { i18nKey: 'Ignored paths' },
          placeholder: 'Ignore pattern',
        }}
      />
    </>
  )
}

function EditorProbe() {
  useEffect(() => {
    state.mounted()
    return () => state.cleanedUp()
  }, [])

  return (
    <div data-editor-active='true'>
      <textarea aria-label='Draft' defaultValue='Unsaved draft' />
      <Button onClick={() => state.handler?.()}>Open settings</Button>
    </div>
  )
}

function AppProbe() {
  const location = useLocation()
  const routeState = location.state as SettingRouteState | null
  return (
    <>
      <SettingRouteController />
      <WorkspaceRouteSurface inactive={location.pathname === '/settings'}>
        <EditorProbe />
      </WorkspaceRouteSurface>
      <Routes>
        <Route path='/' element={null} />
        <Route
          path='/settings'
          element={<Setting navigationRequest={routeState?.navigationRequest} />}
        />
      </Routes>
    </>
  )
}

let narrowViewport = false

beforeEach(() => {
  vi.clearAllMocks()
  narrowViewport = false
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: narrowViewport,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => true,
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
  return screen.findByRole('dialog', { name: 'settings.label' })
}

function pressEscape(target: Element = document.activeElement ?? document.body) {
  fireEvent.keyDown(target, { key: 'Escape' })
}

describe('Settings dialog integration', () => {
  it('keeps the workspace and unsaved draft alive, then restores editor focus on close', async () => {
    const { container } = render(
      <StrictMode>
        <MemoryRouter>
          <AppProbe />
        </MemoryRouter>
      </StrictMode>,
    )
    const draft = screen.getByRole('textbox', { name: 'Draft' }) as HTMLTextAreaElement
    fireEvent.change(draft, { target: { value: 'Keep this unsaved edit' } })
    const mountsBefore = state.mounted.mock.calls.length
    const cleanupsBefore = state.cleanedUp.mock.calls.length
    const dialog = await openSettings()

    expect(container.contains(dialog)).toBe(false)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('searchbox'))
    expect(state.mounted).toHaveBeenCalledTimes(mountsBefore)
    expect(state.cleanedUp).toHaveBeenCalledTimes(cleanupsBefore)
    expect(container.querySelector('[data-mf-workspace-surface]')?.hasAttribute('inert')).toBe(true)

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(draft))
    expect(draft.value).toBe('Keep this unsaved edit')
    expect(state.cleanedUp).toHaveBeenCalledTimes(cleanupsBefore)
    expect(container.querySelector('[data-mf-workspace-surface]')?.hasAttribute('inert')).toBe(
      false,
    )
  })

  it('closes a nested dialog before settings and restores focus to its trigger', async () => {
    render(
      <MemoryRouter>
        <AppProbe />
      </MemoryRouter>,
    )
    const settings = await openSettings()
    const trigger = screen.getByRole('button', { name: 'Open nested dialog' })
    act(() => trigger.focus())
    fireEvent.click(trigger)
    const nested = await screen.findByRole('dialog', { name: 'Nested dialog' })

    pressEscape(nested)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nested dialog' })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'settings.label' })).toBe(settings)
    await waitFor(() => expect(document.activeElement).toBe(trigger))

    pressEscape()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('lets a popover consume Escape without closing settings', async () => {
    render(
      <MemoryRouter>
        <AppProbe />
      </MemoryRouter>,
    )
    const settings = await openSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Open popover' }))
    const action = await screen.findByRole('button', { name: 'Popover action' })
    pressEscape(action)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Popover action' })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'settings.label' })).toBe(settings)
  })

  it('lets a Select consume Escape before closing settings', async () => {
    render(
      <MemoryRouter>
        <AppProbe />
      </MemoryRouter>,
    )
    const settings = await openSettings()
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Theme' }), { key: 'Enter' })
    const options = await screen.findByRole('listbox')
    pressEscape(options)
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(screen.getByRole('dialog', { name: 'settings.label' })).toBe(settings)
  })

  it.each(['edit', 'add'])('cancels an inline %s before closing settings', async (mode) => {
    render(
      <MemoryRouter>
        <AppProbe />
      </MemoryRouter>,
    )
    const settings = await openSettings()
    fireEvent.click(
      screen.getByRole('button', { name: mode === 'edit' ? 'Edit item' : 'common.addPattern' }),
    )
    const input = screen.getByPlaceholderText('Ignore pattern')
    fireEvent.change(input, { target: { value: 'Do not save this pattern' } })
    pressEscape(input)

    expect(screen.queryByPlaceholderText('Ignore pattern')).toBeNull()
    expect(screen.getByText('**/node_modules/**')).not.toBeNull()
    expect(state.writeSettingData).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'settings.label' })).toBe(settings)

    pressEscape(settings)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('returns to category navigation on narrow screens before dismissing settings', async () => {
    narrowViewport = true
    render(
      <MemoryRouter>
        <AppProbe />
      </MemoryRouter>,
    )
    const settings = await openSettings()
    const category = screen.getByRole('button', { name: 'Editor' })
    fireEvent.click(category)
    const heading = screen.getByRole('heading', { name: 'Editor' })
    await waitFor(() => expect(document.activeElement).toBe(heading))

    pressEscape(heading)
    await waitFor(() => expect(document.activeElement).toBe(category))
    expect(screen.getByRole('dialog', { name: 'settings.label' })).toBe(settings)

    pressEscape(category)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('updates targeted navigation without remounting the dialog or repeating the update check', async () => {
    render(
      <MemoryRouter>
        <AppProbe />
      </MemoryRouter>,
    )
    const settings = await openSettings()
    const checksBefore = state.checkUpdate.mock.calls.length
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Editor' } })

    act(() => state.handler?.({ category: 'ai', providerId: 'google' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Selected provider').textContent).toBe('google'),
    )
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
    act(() => state.handler?.({ category: 'ai', providerId: 'ollama' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Selected provider').textContent).toBe('ollama'),
    )

    expect(screen.getByRole('dialog', { name: 'settings.label' })).toBe(settings)
    expect(state.checkUpdate).toHaveBeenCalledTimes(checksBefore)
  })

  it('keeps focus inside the modal and ignores composing or repeated Escape', async () => {
    render(
      <MemoryRouter>
        <AppProbe />
      </MemoryRouter>,
    )
    const settings = await openSettings()
    const close = screen.getByRole('button', { name: 'common.close' })
    act(() => close.focus())
    fireEvent.keyDown(close, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('searchbox'))
    fireEvent.keyDown(settings, { key: 'Escape', isComposing: true })
    fireEvent.keyDown(settings, { key: 'Escape', repeat: true })
    expect(screen.getByRole('dialog', { name: 'settings.label' })).toBe(settings)

    pressEscape(settings)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
