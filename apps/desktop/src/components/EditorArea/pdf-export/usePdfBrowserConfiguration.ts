import { useCallback, useEffect, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import {
  PDF_BROWSER_EXECUTABLE_PATH_SETTING,
  probePdfBrowser,
  type PdfBrowserInfo,
} from './pdfExport'
import { normalizePdfBrowserError } from './pdfBrowserDiagnostics'

interface BrowserProbe {
  path: string
  checking: boolean
  info?: PdfBrowserInfo
  error?: string
}

export interface PdfBrowserConfiguration {
  configuredPath: string
  info?: PdfBrowserInfo
  checking: boolean
  configuring: boolean
  saveError: boolean
  checkError?: string
  selectExecutable: () => Promise<void>
  resetToAutomatic: () => Promise<void>
  checkBrowser: (refresh?: boolean) => Promise<void>
}

function getConfiguredPath(): string {
  const value = useAppSettingStore.getState().settingData[PDF_BROWSER_EXECUTABLE_PATH_SETTING]
  return typeof value === 'string' ? value.trim() : ''
}

/** Settings and export share one persisted browser choice and probe lifecycle. */
export function usePdfBrowserConfiguration(enabled = true): PdfBrowserConfiguration {
  const configuredPath = useAppSettingStore((state) => {
    const value = state.settingData[PDF_BROWSER_EXECUTABLE_PATH_SETTING]
    return typeof value === 'string' ? value.trim() : ''
  })
  const [probe, setProbe] = useState<BrowserProbe>()
  const [configuring, setConfiguring] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const activeRef = useRef(false)
  const sessionRef = useRef(0)
  const requestRef = useRef(0)
  const operationRef = useRef<symbol | null>(null)

  useEffect(() => {
    activeRef.current = enabled
    sessionRef.current += 1
    setSaveError(false)
    setConfiguring(false)
    if (!enabled) setProbe(undefined)
    return () => {
      activeRef.current = false
      sessionRef.current += 1
      requestRef.current += 1
      operationRef.current = null
    }
  }, [enabled])

  const checkBrowser = useCallback(
    async (refresh = false) => {
      if (!enabled || !activeRef.current) return
      const path = getConfiguredPath()
      const request = ++requestRef.current
      const session = sessionRef.current
      const isCurrent = () =>
        activeRef.current &&
        session === sessionRef.current &&
        request === requestRef.current &&
        path === getConfiguredPath()
      setProbe({ path, checking: true })
      try {
        const info = await probePdfBrowser(path || undefined, refresh)
        if (isCurrent()) setProbe({ path, checking: false, info })
      } catch (error: unknown) {
        if (isCurrent()) {
          const normalized = normalizePdfBrowserError(error)
          setProbe({
            path,
            checking: false,
            info: { available: false, compatible: false, error: normalized },
            error: normalized.message,
          })
        }
      }
    },
    [enabled],
  )

  useEffect(() => {
    void checkBrowser()
    return () => {
      requestRef.current += 1
    }
  }, [checkBrowser, configuredPath])

  const configureBrowser = useCallback(
    async (choosePath: () => Promise<string | null>) => {
      if (!enabled || !activeRef.current || operationRef.current) return
      const operation = Symbol('pdf-browser-configuration')
      const session = sessionRef.current
      operationRef.current = operation
      const isCurrent = () =>
        activeRef.current &&
        session === sessionRef.current &&
        operationRef.current === operation
      setConfiguring(true)
      setSaveError(false)
      try {
        const selected = await choosePath()
        // The native picker can finish after its export dialog has closed.
        if (selected === null || !isCurrent()) return
        const previousPath = getConfiguredPath()
        await appSettingService.writeSettingData(
          { key: PDF_BROWSER_EXECUTABLE_PATH_SETTING },
          selected,
        )
        // A changed path is checked by the store subscription. Choosing the
        // same executable can still mean that it was updated or repaired.
        if (isCurrent() && selected.trim() === previousPath) await checkBrowser(true)
      } catch {
        if (isCurrent()) setSaveError(true)
      } finally {
        if (operationRef.current === operation) {
          if (isCurrent()) setConfiguring(false)
          operationRef.current = null
        }
      }
    },
    [checkBrowser, enabled],
  )

  const selectExecutable = useCallback(
    () =>
      configureBrowser(async () => {
        const selected = await open({
          directory: false,
          multiple: false,
          fileAccessMode: 'scoped',
        })
        return typeof selected === 'string' ? selected : null
      }),
    [configureBrowser],
  )
  const resetToAutomatic = useCallback(
    () => configureBrowser(async () => ''),
    [configureBrowser],
  )
  const currentProbe = enabled && probe?.path === configuredPath ? probe : undefined

  return {
    configuredPath,
    info: currentProbe?.info,
    checking: enabled && (!currentProbe || currentProbe.checking),
    configuring: enabled && configuring,
    saveError: enabled && saveError,
    checkError: currentProbe?.error,
    selectExecutable,
    resetToAutomatic,
    checkBrowser,
  }
}
