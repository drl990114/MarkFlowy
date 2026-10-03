import { commandRegistry } from '@/commands'
import {
  captureActiveEditorFocus,
  scheduleActiveEditorFocus,
  type EditorFocusSnapshot,
} from '@/components/EditorArea/focusActiveEditor'
import { EVENT } from '@/constants'
import type { OpenSettingTarget } from '@/extensions/ai/aiProvidersService'
import type { SettingNavigationRequest } from '@/router/Setting'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

export interface SettingRouteState {
  navigationRequest?: SettingNavigationRequest
}

export function SettingRouteController() {
  const location = useLocation()
  const navigate = useNavigate()
  const requestIdRef = useRef(0)
  const wasSettingsRouteRef = useRef(location.pathname === '/settings')
  const editorFocusRef = useRef<EditorFocusSnapshot | null>(null)

  useEffect(() => () => editorFocusRef.current?.release(), [])

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: EVENT.app_openSetting,
      handler: (target?: OpenSettingTarget) => {
        if (location.pathname !== '/settings') {
          editorFocusRef.current?.release()
          editorFocusRef.current = captureActiveEditorFocus()
        }
        requestIdRef.current += 1
        navigate('/settings', {
          replace: location.pathname === '/settings',
          state: {
            navigationRequest: {
              id: requestIdRef.current,
              target: target ? { ...target } : undefined,
            },
          } satisfies SettingRouteState,
        })
      },
    })

    return () => disposable.dispose()
  }, [location.pathname, navigate])

  useEffect(() => {
    const isSettingsRoute = location.pathname === '/settings'

    const leavingSettings = wasSettingsRouteRef.current && !isSettingsRoute
    wasSettingsRouteRef.current = isSettingsRoute
    if (!leavingSettings) return

    const snapshot = editorFocusRef.current
    editorFocusRef.current = null
    return scheduleActiveEditorFocus(snapshot)
  }, [location.pathname])

  return null
}
