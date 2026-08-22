import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import TitleBar from '.'

const titleBarTestState = vi.hoisted(() => ({
  osType: 'macos' as 'linux' | 'macos' | 'windows',
  rootPath: '',
}))

vi.mock('@/hooks', () => ({
  useGlobalOSInfo: () => ({ osType: titleBarTestState.osType }),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common.close': 'Close',
        'common.menu': 'Menu',
        'file.clearRecent': 'Clear Recent',
        'file.openDir': 'Open Folder',
        'file.openFolderModal.currentWindow': 'Current Window',
        'file.recentDir': 'Recently opened folders',
        'search.search_empty': 'No matching workspaces',
        'titleBar.label': 'Window title bar',
        'titleBar.maximize': 'Maximize window',
        'titleBar.minimize': 'Minimize window',
        'titleBar.restore': 'Restore window',
        'welcome.recentWorkspaces': 'Recent Workspaces',
        'workspace.searchPlaceholder': 'Search workspaces…',
      })[key] ?? key,
  }),
}))

vi.mock('@/hooks/useOpen', () => ({
  default: () => ({ openFolder: vi.fn(), openFolderDialog: vi.fn() }),
}))

vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: { folderData: { path: string }[] }) => unknown) =>
    selector({
      folderData: titleBarTestState.rootPath ? [{ path: titleBarTestState.rootPath }] : [],
    }),
}))

vi.mock('@/stores/useOpenedCacheStore', () => ({
  default: (selector: (state: unknown) => unknown) =>
    selector({ clearRecentWorkspaces: vi.fn(), recentWorkspaces: [] }),
}))

vi.mock('@/services/windows', () => ({
  currentWindow: {
    close: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    label: 'main',
    minimize: vi.fn(),
    onResized: vi.fn().mockResolvedValue(vi.fn()),
    toggleMaximize: vi.fn(),
  },
}))

vi.mock('@/stores/useThemeStore', () => ({
  default: () => ({ themeMode: 'system', setThemeMode: vi.fn() }),
}))

vi.mock('@tauri-apps/api/event', () => ({ emitTo: vi.fn() }))
vi.mock('../ui-v2/ContextMenu/ContextMenu', () => ({ showContextMenu: vi.fn() }))

describe('TitleBar', () => {
  it('keeps native macOS traffic-light space and leaves the menu trigger interactive', () => {
    titleBarTestState.osType = 'macos'
    titleBarTestState.rootPath = ''
    const markup = renderToStaticMarkup(<TitleBar />)

    expect(markup).toContain('data-mf-platform="macos"')
    expect(markup).toContain('data-tauri-drag-region="true"')
    expect(markup).toContain('pl-[76px]')
    expect(markup).toContain('border-titlebar-border')
    expect(markup).toContain('size-3.5 text-content-primary')
    expect(markup).toContain('MarkFlowy')
    expect(markup).toContain('data-slot="workspace-picker-trigger"')
    expect(markup).toContain('role="combobox"')
    expect(markup).toContain('>Open Folder</span>')
    expect(markup.match(/data-slot="workspace-picker-trigger"/g)).toHaveLength(1)
    expect(markup.indexOf('MarkFlowy</span>')).toBeLessThan(
      markup.indexOf('data-slot="workspace-picker-trigger"'),
    )
    expect(markup.indexOf('MarkFlowy</span>')).toBeLessThan(
      markup.indexOf('aria-label="MarkFlowy Menu"'),
    )
    expect(markup).not.toContain('data-mf-window-controls')
  })

  it('replaces the application name with the active workspace name', () => {
    titleBarTestState.osType = 'macos'
    titleBarTestState.rootPath = '/Users/test/notes'
    const markup = renderToStaticMarkup(<TitleBar />)

    expect(markup).not.toContain('MarkFlowy</span>')
    expect(markup).toContain('>notes</span>')
    expect(markup).not.toContain('h-3.5 w-px')
  })

  it('renders accessible window controls for the frameless Windows shell', () => {
    titleBarTestState.osType = 'windows'
    titleBarTestState.rootPath = ''
    const markup = renderToStaticMarkup(<TitleBar />)

    expect(markup).toContain('data-mf-platform="windows"')
    expect(markup).toContain('data-mf-window-controls=""')
    expect(markup).toContain('aria-label="Minimize window"')
    expect(markup).toContain('aria-label="Maximize window"')
    expect(markup).toContain('aria-label="Close"')
  })

  it('keeps the native Linux title bar without rendering a duplicate app bar', () => {
    titleBarTestState.osType = 'linux'
    titleBarTestState.rootPath = ''

    expect(renderToStaticMarkup(<TitleBar />)).toBe('')
  })
})
