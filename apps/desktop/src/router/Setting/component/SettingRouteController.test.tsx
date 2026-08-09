import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenSettingTarget } from '@/extensions/ai/aiProvidersService'
import type { SettingRouteState } from './SettingRouteController'
import { SettingRouteController } from './SettingRouteController'

const command = vi.hoisted(() => ({
  handler: undefined as ((target?: OpenSettingTarget) => void) | undefined,
}))

vi.mock('@/commands', () => ({
  commandRegistry: {
    registerCommand: ({ handler }: { handler: (target?: OpenSettingTarget) => void }) => {
      command.handler = handler
      return { dispose: vi.fn() }
    },
  },
}))

function LocationProbe() {
  const location = useLocation()
  const routeState = location.state as SettingRouteState | null
  const navigationRequest = routeState?.navigationRequest

  return (
    <div
      data-category={navigationRequest?.target?.category}
      data-pathname={location.pathname}
      data-provider={navigationRequest?.target?.providerId}
      data-request-id={navigationRequest?.id}
    />
  )
}

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('SettingRouteController navigation command', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    command.handler = undefined
    container = document.createElement('div')
    root = createRoot(container)
    act(() => {
      root.render(
        <MemoryRouter>
          <SettingRouteController />
          <LocationProbe />
        </MemoryRouter>,
      )
    })
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('navigates to the settings route and updates an AI provider request in place', () => {
    expect(command.handler).toBeTypeOf('function')

    act(() => command.handler?.({ category: 'ai', providerId: 'google' }))
    expect(container.querySelector('[data-pathname="/settings"]')).not.toBeNull()
    expect(container.querySelector('[data-provider="google"]')).not.toBeNull()
    const firstRequestId = container
      .querySelector('[data-request-id]')
      ?.getAttribute('data-request-id')

    act(() => command.handler?.({ category: 'ai', providerId: 'ollama' }))
    expect(container.querySelector('[data-provider="ollama"]')).not.toBeNull()
    expect(container.querySelector('[data-request-id]')?.getAttribute('data-request-id')).not.toBe(
      firstRequestId,
    )
  })

  it('lets an open layer consume Escape before returning to the app', () => {
    act(() => command.handler?.())
    expect(container.querySelector('[data-pathname="/settings"]')).not.toBeNull()

    const closeLayer = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault()
    }
    document.addEventListener('keydown', closeLayer, { capture: true })

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }),
      )
    })
    document.removeEventListener('keydown', closeLayer, { capture: true })

    expect(container.querySelector('[data-pathname="/settings"]')).not.toBeNull()

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }),
      )
    })
    expect(container.querySelector('[data-pathname="/"]')).not.toBeNull()
  })
})
