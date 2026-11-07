import { getCurrentWebview } from '@tauri-apps/api/webview'
import { writeSettingPatch } from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { KeyboardBinding } from './keybindingCatalog'
import { keyMapsOverlap, sameKeyMap, shortcutString } from './keybindingKeys'

export const ZOOM_COMMANDS = ['app_zoomIn', 'app_zoomOut', 'app_zoomReset'] as const
export type ZoomCommand = (typeof ZOOM_COMMANDS)[number]

/** Plus is a compatibility key for the untouched default, not another saved binding. */
export function zoomInPlusShortcut(bindings: readonly KeyboardBinding[]): string | undefined {
  const defaultZoomIn = bindings.find((binding) =>
    binding.id === 'app_zoomIn.default' && binding.command === 'app_zoomIn',
  )
  if (!defaultZoomIn || !sameKeyMap(defaultZoomIn.keys, ['CommandOrCtrl', '[Equal]']))
    return undefined
  const physicalPlus = ['CommandOrCtrl', 'Shift', '[Equal]']
  const semanticPlus = ['CommandOrCtrl', 'Shift', '+']
  // Recorded overrides use characters; imported bindings may use physical codes.
  // Either kind of explicit ownership takes priority over this compatibility key.
  if (bindings.some((binding) => binding.command !== 'app_zoomIn' && (
    keyMapsOverlap(binding.keys, physicalPlus) || keyMapsOverlap(binding.keys, semanticPlus)
  ))) return undefined
  return shortcutString(physicalPlus)
}

function normalizeZoom(current: unknown): number {
  const value = Number(current)
  return Number.isFinite(value) && value >= 0.5 && value <= 2 ? value : 1
}

export function nextZoom(current: unknown, command: ZoomCommand): number {
  const zoom = normalizeZoom(current)
  if (command === 'app_zoomReset') return 1
  return Math.min(2, Math.max(0.5, Math.round((zoom + (command === 'app_zoomIn' ? 0.1 : -0.1)) * 10) / 10))
}

let zoomQueue: Promise<void> = Promise.resolve()

/** Serialize rapid shortcuts so each step starts from the last committed zoom. */
export function executeZoomCommand(command: ZoomCommand): Promise<void> {
  const task = zoomQueue.then(async () => {
    const current = useAppSettingStore.getState().settingData.webview_zoom
    const previous = normalizeZoom(current)
    const zoom = nextZoom(current, command)
    if (zoom === Number(current)) return
    const webview = getCurrentWebview()
    await webview.setZoom(zoom)
    try {
      await writeSettingPatch({ webview_zoom: String(zoom) })
    } catch (error) {
      await webview.setZoom(Math.min(2, Math.max(0.5, previous))).catch(() => undefined)
      throw error
    }
  })
  zoomQueue = task.catch(() => undefined)
  return task
}
