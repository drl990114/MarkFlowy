import { describe, expect, it, vi } from 'vitest'
import { getSettingMap } from './settingMap'
import {
  createSettingSearchIndex,
  filterSettingSearchEntries,
  getSettingSearchPath,
} from './settingSearch'

vi.mock('@/services/windows', () => ({
  currentWebview: { setZoom: vi.fn() },
}))

const translations: Record<string, string> = {
  'settings.general.label': 'General',
  'settings.general.autosave.label': 'Auto Save',
  'settings.general.autosave.autosaveInterval.label': 'Save interval',
  'settings.general.autosave.autosaveInterval.desc': 'How often files are saved',
  'settings.ai.label': 'AI',
  'settings.ai.model.label': 'Provider',
  'settings.ai.Google.label': 'Google',
  'settings.ai.Google.api_key.label': 'API key',
  'settings.display.theme.dark_theme.label': 'Dark theme',
  'settings.display.theme.dark_theme.desc': 'Theme used in dark mode',
  'settings.export.label': 'Export',
  'settings.export.pdf.label': 'PDF export',
  'settings.export.pdf.executable.label': 'PDF export browser',
  'settings.export.pdf.executable.desc': 'Chrome, Chromium or Edge browser for PDF bookmarks',
}

const translate = (key: string) => translations[key] ?? key

describe('settings search index', () => {
  const entries = createSettingSearchIndex(getSettingMap())

  it('matches field titles and descriptions and preserves their path', () => {
    const titleResult = filterSettingSearchEntries(entries, 'save interval', translate).find(
      (entry) => entry.settingKey === 'autosave_interval',
    )
    const descriptionResult = filterSettingSearchEntries(entries, 'how often', translate).find(
      (entry) => entry.settingKey === 'autosave_interval',
    )

    expect(titleResult).toBeDefined()
    expect(descriptionResult).toBeDefined()
    expect(getSettingSearchPath(titleResult!, translate)).toEqual(['General', 'Auto Save'])
  })

  it('keeps provider identity so a result can open and focus the right AI tab', () => {
    const result = entries.find((entry) => entry.settingKey === 'extensions_google_apikey')

    expect(result).toMatchObject({
      categoryKey: 'ai',
      childId: 'google',
      settingKey: 'extensions_google_apikey',
    })
    expect(getSettingSearchPath(result!, translate)).toEqual(['AI', 'Provider', 'Google'])
  })

  it('includes fields rendered outside the declarative setting map', () => {
    const results = filterSettingSearchEntries(entries, 'dark theme', translate)

    expect(results).toContainEqual(
      expect.objectContaining({ categoryKey: 'display', settingKey: 'dark_theme' }),
    )
  })

  it('returns no results for a blank query', () => {
    expect(filterSettingSearchEntries(entries, '   ', translate)).toEqual([])
  })

  it('finds the PDF browser setting from browser names and reveals the PDF group', () => {
    const result = filterSettingSearchEntries(entries, 'chromium', translate).find(
      (entry) => entry.settingKey === 'pdf_browser_executable_path',
    )
    expect(result).toMatchObject({ categoryKey: 'export', groupKey: 'pdf' })
    expect(getSettingSearchPath(result!, translate)).toEqual(['Export', 'PDF export'])
  })
})
