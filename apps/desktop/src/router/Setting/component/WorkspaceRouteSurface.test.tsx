import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceRouteSurface } from './WorkspaceRouteSurface'

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('WorkspaceRouteSurface', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('keeps workspace effects mounted while the settings route is active', () => {
    const mounted = vi.fn()
    const cleanedUp = vi.fn()

    function LifecycleProbe() {
      useEffect(() => {
        mounted()
        return () => cleanedUp()
      }, [])

      return <div data-lifecycle-probe='' />
    }

    const renderSurface = (inactive: boolean) => {
      act(() => {
        root.render(
          <WorkspaceRouteSurface inactive={inactive}>
            <LifecycleProbe />
          </WorkspaceRouteSurface>,
        )
      })
    }

    renderSurface(false)
    const surface = container.querySelector<HTMLElement>('[data-mf-workspace-surface]')
    expect(mounted).toHaveBeenCalledOnce()
    expect(cleanedUp).not.toHaveBeenCalled()
    expect(surface?.hasAttribute('inert')).toBe(false)
    expect(surface?.getAttribute('aria-hidden')).toBeNull()

    renderSurface(true)
    expect(mounted).toHaveBeenCalledOnce()
    expect(cleanedUp).not.toHaveBeenCalled()
    expect(surface?.hasAttribute('inert')).toBe(true)
    expect(surface?.getAttribute('aria-hidden')).toBe('true')
    expect(surface?.classList.contains('invisible')).toBe(true)

    renderSurface(false)
    expect(mounted).toHaveBeenCalledOnce()
    expect(cleanedUp).not.toHaveBeenCalled()
    expect(surface?.hasAttribute('inert')).toBe(false)
    expect(surface?.classList.contains('invisible')).toBe(false)
  })
})
