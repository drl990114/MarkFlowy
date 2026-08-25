import { commandRegistry } from '@/commands'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
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

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: EVENT.app_openSetting,
      handler: (target?: OpenSettingTarget) => {
        requestIdRef.current += 1
        navigate('/settings', {
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
  }, [navigate])

  useEffect(() => {
    const isSettingsRoute = location.pathname === '/settings'

    if (wasSettingsRouteRef.current && !isSettingsRoute) {
      scheduleActiveEditorFocus()
    }

    wasSettingsRouteRef.current = isSettingsRoute
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname !== '/settings') return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.repeat) {
        return
      }

      navigate('/')
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [location.pathname, navigate])

  return null
}
