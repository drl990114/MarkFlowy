import { describe, expect, it, vi } from 'vitest'
import {
  queueDoubleEscapeResolution,
  registerZenModeCommand,
  requestZenModeToggle,
  resolveDoubleEscape,
  ZEN_MODE_ESCAPE_INTERVAL_MS,
} from './zenMode'

const escapeInput = (now: number) => ({
  defaultPrevented: false,
  isComposing: false,
  key: 'Escape',
  now,
  repeat: false,
})

describe('queueDoubleEscapeResolution', () => {
  it('resolves Escape after propagation even when the editor stops bubbling', async () => {
    let lastEscapeAt: number | null = null
    const onExit = vi.fn()
    const queueEscape = (event: KeyboardEvent, now: number) =>
      queueDoubleEscapeResolution({
        event,
        getLastEscapeAt: () => lastEscapeAt,
        isActive: () => true,
        now,
        onExit,
        setLastEscapeAt: (next) => {
          lastEscapeAt = next
        },
      })

    const first = new KeyboardEvent('keydown', { cancelable: true, key: 'Escape' })
    queueEscape(first, 100)
    first.stopPropagation()
    await Promise.resolve()

    const second = new KeyboardEvent('keydown', { cancelable: true, key: 'Escape' })
    queueEscape(second, 500)
    second.stopPropagation()
    await Promise.resolve()

    expect(onExit).toHaveBeenCalledOnce()
  })

  it('lets a layer prevent Escape before the deferred resolution runs', async () => {
    let lastEscapeAt: number | null = 100
    const onExit = vi.fn()
    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Escape' })

    queueDoubleEscapeResolution({
      event,
      getLastEscapeAt: () => lastEscapeAt,
      isActive: () => true,
      now: 400,
      onExit,
      setLastEscapeAt: (next) => {
        lastEscapeAt = next
      },
    })
    event.preventDefault()
    await Promise.resolve()

    expect(onExit).not.toHaveBeenCalled()
    expect(lastEscapeAt).toBeNull()
  })
})

describe('registerZenModeCommand', () => {
  it('registers the public View command and returns its disposable', () => {
    const dispose = vi.fn()
    const registerCommand = vi.fn(() => ({ dispose }))
    const handler = vi.fn()

    const disposable = registerZenModeCommand({ registerCommand }, { handler, label: 'Zen Mode' })

    expect(registerCommand).toHaveBeenCalledWith({
      id: 'app_toggleZenMode',
      label: 'Zen Mode',
      category: 'View',
      handler,
    })

    disposable.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })
})

describe('requestZenModeToggle', () => {
  it('does not enter Zen Mode without an active document', () => {
    const onToggled = vi.fn()
    const onUnavailable = vi.fn()

    expect(
      requestZenModeToggle({
        active: false,
        hasActiveDocument: false,
        onToggled,
        onUnavailable,
      }),
    ).toBe(false)
    expect(onUnavailable).toHaveBeenCalledOnce()
    expect(onToggled).not.toHaveBeenCalled()
  })

  it('enters and exits through the same toggle', () => {
    const onToggled = vi.fn()

    expect(
      requestZenModeToggle({
        active: false,
        hasActiveDocument: true,
        onToggled,
        onUnavailable: vi.fn(),
      }),
    ).toBe(true)
    expect(onToggled).toHaveBeenLastCalledWith(true)

    requestZenModeToggle({
      active: true,
      hasActiveDocument: false,
      onToggled,
      onUnavailable: vi.fn(),
    })
    expect(onToggled).toHaveBeenLastCalledWith(false)
  })
})

describe('resolveDoubleEscape', () => {
  it('exits after two valid Escape presses inside the interval', () => {
    const first = resolveDoubleEscape(null, escapeInput(0))
    const second = resolveDoubleEscape(first.lastEscapeAt, escapeInput(400))

    expect(first.exitZenMode).toBe(false)
    expect(second).toEqual({ exitZenMode: true, lastEscapeAt: null })
  })

  it('starts a new sequence when the interval expires', () => {
    const result = resolveDoubleEscape(100, escapeInput(100 + ZEN_MODE_ESCAPE_INTERVAL_MS + 1))

    expect(result).toEqual({
      exitZenMode: false,
      lastEscapeAt: 100 + ZEN_MODE_ESCAPE_INTERVAL_MS + 1,
    })
  })

  it.each([
    { defaultPrevented: true, isComposing: false, repeat: false },
    { defaultPrevented: false, isComposing: true, repeat: false },
    { defaultPrevented: false, isComposing: false, repeat: true },
  ])('ignores invalid Escape input %#', (invalidState) => {
    expect(
      resolveDoubleEscape(100, {
        ...escapeInput(200),
        ...invalidState,
      }),
    ).toEqual({ exitZenMode: false, lastEscapeAt: null })
  })

  it('resets the sequence when another key is pressed', () => {
    expect(
      resolveDoubleEscape(100, {
        ...escapeInput(200),
        key: 'a',
      }),
    ).toEqual({ exitZenMode: false, lastEscapeAt: null })
  })
})
