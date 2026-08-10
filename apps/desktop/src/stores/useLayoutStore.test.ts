import { beforeEach, describe, expect, it } from 'vitest'
import useLayoutStore from './useLayoutStore'

beforeEach(() => {
  useLayoutStore.setState({
    leftBar: { visible: true },
    rightBar: { visible: true },
    zenModeActive: false,
  })
})

describe('useLayoutStore Zen Mode state', () => {
  it('is transient and disabled by default', () => {
    expect(useLayoutStore.getState().zenModeActive).toBe(false)
  })

  it('toggles Zen Mode without changing sidebar visibility', () => {
    useLayoutStore.getState().setLeftBarVisible(false)
    useLayoutStore.getState().toggleZenMode()

    expect(useLayoutStore.getState().zenModeActive).toBe(true)
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
    expect(useLayoutStore.getState().rightBar.visible).toBe(true)

    useLayoutStore.getState().setZenModeActive(false)
    expect(useLayoutStore.getState().zenModeActive).toBe(false)
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
  })
})
