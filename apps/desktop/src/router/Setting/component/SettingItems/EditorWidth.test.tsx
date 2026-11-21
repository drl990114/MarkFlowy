import type * as TauriCore from '@tauri-apps/api/core'
import type * as TauriEvent from '@tauri-apps/api/event'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'zens'
import { logger } from '@/helper/logger'
import useAppSettingStore from '@/stores/useAppSettingStore'
import SettingItem from '.'

const native = vi.hoisted(() => ({ invoke: vi.fn(), emit: vi.fn() }))
vi.mock('@tauri-apps/api/core', async (importOriginal) => ({
  ...(await importOriginal<typeof TauriCore>()),
  invoke: native.invoke,
}))
vi.mock('@tauri-apps/api/event', async (importOriginal) => ({
  ...(await importOriginal<typeof TauriEvent>()),
  emit: native.emit,
}))
vi.mock('@/startup/sentry', () => ({ syncErrorReportingPreference: vi.fn() }))
vi.mock('@/i18n', () => {
  const t = (key: string) => key
  return { useTranslation: () => ({ t }) }
})

const labels = 'settings.editor.style.content_width'
const item: Setting.SettingItem = {
  type: 'editorWidth',
  key: 'editor_width_mode',
  title: { i18nKey: `${labels}.label` },
}
const initialStore = useAppSettingStore.getState()
let config: Record<string, unknown>

function input() {
  return screen.getByRole<HTMLInputElement>('spinbutton', { name: `${labels}.maximum` })
}

function sliderTrack() {
  const track = screen.getByRole('slider').closest<HTMLElement>('[data-slot="slider"]')!
  // Happy DOM supplies neither native pointer capture nor a measured slider track.
  const captured = new Set<number>()
  Object.assign(track, {
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  })
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1120, 28))
  return track
}

beforeEach(() => {
  config = { editor_width_mode: 'fixed', editor_fixed_width: 760 }
  useAppSettingStore.getState().setSettingData(config)
  native.invoke.mockImplementation(async (command, { data }) => {
    expect(command).toBe('save_app_conf')
    config = { ...config, ...data }
    return config
  })
  native.emit.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  useAppSettingStore.setState(initialStore, true)
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('document width setting', () => {
  it('saves and broadcasts during a drag, coalesces moves and flushes the last width on release', async () => {
    vi.useFakeTimers()
    render(<SettingItem item={item} />)
    const track = sliderTrack()
    expect(input().value).toBe('760')
    expect(screen.queryByRole('figure')).toBeNull()

    await act(async () => fireEvent.pointerDown(track, { pointerId: 1, clientX: 0, button: 0 }))
    expect(config.editor_fixed_width).toBe(480)
    expect(native.emit).toHaveBeenCalledExactlyOnceWith('app_conf_change')

    fireEvent.pointerMove(track, { pointerId: 1, clientX: 319 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 320 })
    expect(input().value).toBe('800')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(config.editor_fixed_width).toBe(800)
    expect(native.invoke).toHaveBeenCalledTimes(2)
    expect(native.emit).toHaveBeenCalledTimes(2)

    fireEvent.pointerMove(track, { pointerId: 1, clientX: 280 })
    await act(async () => fireEvent.pointerUp(track, { pointerId: 1, clientX: 280 }))
    expect(config.editor_fixed_width).toBe(760)
    expect(native.emit).toHaveBeenCalledTimes(3)
  })

  it('saves the last drag position when the settings close before pointer release', async () => {
    vi.useFakeTimers()
    const view = render(<SettingItem item={item} />)
    const track = sliderTrack()
    await act(async () => fireEvent.pointerDown(track, { pointerId: 1, clientX: 0, button: 0 }))
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 1120 })
    await act(async () => view.unmount())
    expect(config.editor_fixed_width).toBe(1600)
    expect(native.emit).toHaveBeenCalledTimes(2)
  })

  it('keeps the thumb at the latest position while saving and restores the saved width on failure', async () => {
    vi.useFakeTimers()
    let finishFirstSave!: () => void
    native.invoke.mockImplementationOnce(
      (_command, { data }) =>
        new Promise((resolve) => {
          finishFirstSave = () => {
            config = { ...config, ...data }
            resolve(config)
          }
        }),
    )
    vi.spyOn(logger, 'error').mockImplementationOnce(() => {})
    const notice = vi.spyOn(toast, 'error').mockReturnValueOnce('width-error')
    render(<SettingItem item={item} />)
    const track = sliderTrack()

    await act(async () => fireEvent.pointerDown(track, { pointerId: 1, clientX: 0, button: 0 }))
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 320 })
    await act(async () => finishFirstSave())
    expect(config.editor_fixed_width).toBe(480)
    expect(input().value).toBe('800')

    native.invoke.mockRejectedValueOnce(new Error('disk full'))
    await act(async () => fireEvent.pointerUp(track, { pointerId: 1, clientX: 320 }))
    expect(input().value).toBe('480')
    expect(native.emit).toHaveBeenCalledExactlyOnceWith('app_conf_change')
    expect(notice).toHaveBeenCalledWith(`${labels}.save_failed`)
  })

  it('keeps incomplete input local and immediately saves a valid number and reset', async () => {
    render(<SettingItem item={item} />)
    for (const value of ['', '479', '1601', '800.5']) {
      fireEvent.change(input(), { target: { value } })
      fireEvent.keyDown(input(), { key: 'Enter' })
      expect(input().getAttribute('aria-invalid')).toBe('true')
      expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('760')
      expect(native.invoke).not.toHaveBeenCalled()
    }
    expect(input().hasAttribute('data-mf-settings-escape-cancel')).toBe(true)
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(input().value).toBe('760')
    expect(screen.queryByRole('alert')).toBeNull()

    await act(async () => fireEvent.change(input(), { target: { value: '813' } }))
    expect(config.editor_fixed_width).toBe(813)
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('813')
    expect(native.emit).toHaveBeenCalledExactlyOnceWith('app_conf_change')
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.blur(input())
    expect(native.invoke).toHaveBeenCalledTimes(1)

    await act(async () => fireEvent.click(screen.getByRole('button', { name: `${labels}.reset` })))
    expect(config.editor_fixed_width).toBe(760)
    expect(input().value).toBe('760')
  })

  it('broadcasts mode changes and restores the fixed width after theme and full width', async () => {
    config = { editor_full_width: false, editor_fixed_width: 813 }
    useAppSettingStore.getState().setSettingData(config)
    render(<SettingItem item={item} />)
    expect(
      screen.getByRole('radio', { name: `${labels}.theme` }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.queryByRole('figure')).toBeNull()
    for (const mode of ['fixed', 'theme', 'full', 'fixed']) {
      await act(async () =>
        fireEvent.click(screen.getByRole('radio', { name: `${labels}.${mode}` })),
      )
      expect(config.editor_width_mode).toBe(mode)
      expect(screen.queryByRole('figure')).toBeNull()
      if (mode === 'fixed') expect(input().value).toBe('813')
      else expect(screen.queryByRole('slider')).toBeNull()
    }
    expect(native.emit).toHaveBeenCalledTimes(4)
  })

  it('saves keyboard adjustments and reflects incoming width changes without writing them back', async () => {
    render(<SettingItem item={item} />)
    await act(async () => fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' }))
    expect(config.editor_fixed_width).toBe(761)
    act(() => useAppSettingStore.getState().setSettingData({ ...config, editor_fixed_width: 900 }))
    expect(input().value).toBe('900')
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('900')
    expect(native.invoke).toHaveBeenCalledTimes(1)
  })
})
