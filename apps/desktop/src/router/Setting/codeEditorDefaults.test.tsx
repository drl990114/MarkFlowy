import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveThemeTokens } from '@markflowy/theme/semantic'
import { i18n } from '@/i18n'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { SemanticThemeContext } from '@/themes/context'
import SelectSettingItem from './component/SettingItems/Select'
import SliderSettingItem from './component/SettingItems/Slider'
import { getSettingMap } from './settingMap'
import { useSettingMap } from './useSettingMap'

vi.mock('@/services/windows', () => ({ currentWebview: { setZoom: vi.fn() } }))
vi.mock('@/services/app-setting', () => ({ default: { writeSettingData: vi.fn() } }))
vi.mock('@/i18n', async () => {
  const { createInstance } = await import('i18next')
  const { initReactI18next, useTranslation } = await import('react-i18next')
  const { default: translation } = await import('../../../../../locales/zh-CN.json')
  const { default: english } = await import('../../../../../locales/en.json')
  const instance = createInstance()
  await instance.use(initReactI18next).init({
    lng: 'zh-CN', resources: { 'zh-CN': { translation }, en: { translation: english } },
  })
  return { i18n: instance, useTranslation, locales: {}, changeLng: vi.fn() }
})

const initialStore = useAppSettingStore.getState()

function Controls() {
  const { EmbeddedCode, SourceCode } = useSettingMap().editor
  return (
    <>
      <section aria-label='内嵌代码'>
        <SelectSettingItem item={EmbeddedCode.lineWrap} />
        <SelectSettingItem item={EmbeddedCode.lineNumbers} />
        <SelectSettingItem item={EmbeddedCode.highlightActiveLine} />
        <SliderSettingItem item={EmbeddedCode.fontSize} />
        <SliderSettingItem item={EmbeddedCode.lineHeight} />
      </section>
      <section aria-label='全文源码'>
        <SelectSettingItem item={SourceCode.lineNumbers} />
      </section>
    </>
  )
}

const embedded = () => within(screen.getByRole('region', { name: '内嵌代码' }))
const valueOf = (name: string) => embedded().getByRole('combobox', { name }).textContent
const select = async (name: string, option: string) => {
  fireEvent.keyDown(embedded().getByRole('combobox', { name }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('option', { name: option }))
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-CN')
  useAppSettingStore.setState({ settingData: {} })
  vi.mocked(appSettingService.writeSettingData).mockImplementation(async (item, value) => {
    const { settingData, setSettingData } = useAppSettingStore.getState()
    setSettingData({ ...settingData, [item.key]: value })
  })
})

afterEach(() => {
  cleanup()
  useAppSettingStore.setState(initialStore, true)
  vi.clearAllMocks()
})

describe('code editor defaults shown in settings', () => {
  it('shows concrete defaults without persisting fixed overrides', () => {
    render(<Controls />)
    expect(valueOf('自动换行')).toBe('开启（默认）')
    expect(valueOf('行号')).toBe('每行（默认）')
    expect(valueOf('高亮当前行')).toBe('开启（默认）')
    expect(valueOf('代码字号')).toBe('随正文（14 px）')
    expect(valueOf('代码行高')).toBe('1.6 倍（默认）')
    expect(within(screen.getByRole('region', { name: '全文源码' }))
      .getByRole('combobox', { name: '行号' }).textContent).toBe('稀疏（默认）')
    expect(appSettingService.writeSettingData).not.toHaveBeenCalled()
    expect(useAppSettingStore.getState().settingData).toEqual({})
  })

  it('updates inherited typography and starts custom near the displayed size', async () => {
    render(<Controls />)
    act(() => useAppSettingStore.getState().setSettingData({ editor_root_font_size: 20 }))
    expect(valueOf('代码字号')).toBe('随正文（17.5 px）')
    expect(appSettingService.writeSettingData).not.toHaveBeenCalled()
    await select('代码字号', '自定义')
    expect(useAppSettingStore.getState().settingData.editor_code_font_size).toBe(18)
    expect(embedded().getByRole('slider', { name: '代码字号' })
      .getAttribute('aria-valuetext')).toBe('18 px')
    act(() => {
      const { settingData, setSettingData } = useAppSettingStore.getState()
      setSettingData({ ...settingData, editor_root_font_size: 24 })
    })
    expect(embedded().getByRole('slider', { name: '代码字号' })
      .getAttribute('aria-valuenow')).toBe('18')
    await select('代码字号', '随正文（21 px）')
    expect(useAppSettingStore.getState().settingData.editor_code_font_size).toBeNull()
    expect(valueOf('代码字号')).toBe('随正文（21 px）')
  })

  it('uses resolved theme typography and explains inactive personal overrides', () => {
    useAppSettingStore.setState({ settingData: {
      editor_root_font_size: 30,
      theme_use_personal_typography: false,
    } })
    const theme = resolveThemeTokens('light', { 'font.editor.size': '18px' })
    const { rerender } = render(
      <SemanticThemeContext.Provider value={theme}><Controls /></SemanticThemeContext.Provider>,
    )
    expect(valueOf('代码字号')).toBe('随正文（15.75 px）')
    expect(embedded().getAllByText(/自定义字号和行高暂不生效/)).toHaveLength(2)
    rerender(
      <SemanticThemeContext.Provider value={{ ...theme, 'font.editor.size': '24px' }}>
        <Controls />
      </SemanticThemeContext.Provider>,
    )
    expect(valueOf('代码字号')).toBe('随正文（21 px）')
    expect(appSettingService.writeSettingData).not.toHaveBeenCalled()
  })

  it('explains mixed legacy wrapping while retaining explicit choices and reset', async () => {
    render(<Controls />)
    act(() => useAppSettingStore.getState().setSettingData({
      wysiwyg_editor_codemirror_line_wrap: false,
    }))
    expect(valueOf('自动换行')).toBe('按区域（默认）')
    expect(embedded().getByText(/普通代码块不换行，预览块源码和前置信息换行/)).toBeTruthy()
    await select('自动换行', '开启')
    expect(useAppSettingStore.getState().settingData.embedded_code_editor_line_wrap).toBe('on')
    expect(valueOf('自动换行')).toBe('开启')
    await select('自动换行', '按区域（默认）')
    expect(useAppSettingStore.getState().settingData.embedded_code_editor_line_wrap).toBe('default')
    expect(useAppSettingStore.getState().settingData.wysiwyg_editor_codemirror_line_wrap).toBe(false)
  })

  it('describes relative theme sizes without inventing a pixel value', () => {
    const { fontSize } = getSettingMap({ bodyFontSize: '1.25rem' }).editor.EmbeddedCode
    expect(fontSize.optionalValue.defaultLabel).toBe('随正文（87.5%）')
    expect(fontSize.optionalValue.initial).toBe(14)
  })

  it('refreshes default labels when changing language without remounting settings', async () => {
    render(<Controls />)
    const control = embedded().getByRole('combobox', { name: '代码字号' })
    expect(control.textContent).toBe('随正文（14 px）')
    await act(() => i18n.changeLanguage('en'))
    expect(control.isConnected).toBe(true)
    expect(control.textContent).toBe(i18n.t('settings.editor.code_editing.font_size.default', {
      value: 14,
    }))
    expect(control.textContent).not.toBe('随正文（14 px）')
    expect(appSettingService.writeSettingData).not.toHaveBeenCalled()
  })
})
