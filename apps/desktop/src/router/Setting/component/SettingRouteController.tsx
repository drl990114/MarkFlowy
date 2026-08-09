import { commandRegistry } from '@/commands'
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
