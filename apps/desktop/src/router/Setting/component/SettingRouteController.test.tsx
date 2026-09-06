import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenSettingTarget } from '@/extensions/ai/aiProvidersService'
import type { SettingRouteState } from './SettingRouteController'
import { SettingRouteController } from './SettingRouteController'

const command = vi.hoisted(() => ({
  handler: undefined as ((target?: OpenSettingTarget) => void) | undefined,
}))
const focus = vi.hoisted(() => ({ scheduleActiveEditorFocus: vi.fn() }))

vi.mock('@/commands', () => ({
  commandRegistry: {
    registerCommand: ({ handler }: { handler: (target?: OpenSettingTarget) => void }) => {
      command.handler = handler
      return { dispose: vi.fn() }
    },
  },
}))

vi.mock('@/components/EditorArea/focusActiveEditor', () => focus)

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as SettingRouteState | null
  const navigationRequest = routeState?.navigationRequest

  return (
    <div
      data-category={navigationRequest?.target?.category}
      data-pathname={location.pathname}
      data-provider={navigationRequest?.target?.providerId}
      data-request-id={navigationRequest?.id}
    >
      <button onClick={() => navigate('/')} type='button'>
        Close settings
      </button>
      <button onClick={() => navigate(-1)} type='button'>
        Back
      </button>
    </div>
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
    focus.scheduleActiveEditorFocus.mockReset()
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
    expect(focus.scheduleActiveEditorFocus).not.toHaveBeenCalled()
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

  it('restores editor focus after leaving settings', () => {
    act(() => command.handler?.())
    expect(container.querySelector('[data-pathname="/settings"]')).not.toBeNull()

    act(() => container.querySelector<HTMLButtonElement>('button')?.click())
    expect(container.querySelector('[data-pathname="/"]')).not.toBeNull()
    expect(focus.scheduleActiveEditorFocus).toHaveBeenCalledOnce()
  })

  it('keeps repeated settings requests in the same history entry', () => {
    act(() => command.handler?.({ category: 'ai', providerId: 'google' }))
    act(() => command.handler?.({ category: 'ai', providerId: 'ollama' }))

    act(() => container.querySelector<HTMLButtonElement>('button:last-child')?.click())
    expect(container.querySelector('[data-pathname="/"]')).not.toBeNull()
  })
})
