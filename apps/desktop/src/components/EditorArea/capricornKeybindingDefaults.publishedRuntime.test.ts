import { act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { createCapricornKeybindingConfiguration } from './capricornKeybindings'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  type CapricornRuntimeFactory,
  type CapricornRuntimeSession,
} from './capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
let session: CapricornRuntimeSession | undefined

afterEach(async () => {
  await act(async () => session?.destroy())
  session = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

async function mount(markdown: string) {
  const container = document.createElement('div')
  document.body.append(container)
  await act(async () => {
    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
      markdown,
      autoFocus: true,
      virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
      keybindingConfiguration: createCapricornKeybindingConfiguration({}, true),
    })
    await frame()
    await frame()
  })
  await act(async () => {
    session!.find.search({ query: 'Selected' })
    await session!.find.next()
    session!.find.close()
    session!.focus()
    await frame()
  })
  const input = getCapricornRuntimeInput(container)!
  expect(input).not.toBeNull()
  expect(document.activeElement).toBe(input)
  return { container, input }
}

async function press(input: HTMLTextAreaElement, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key === 'Tab' ? 'Tab' : key === '[' ? 'BracketLeft' : 'BracketRight',
    keyCode: key === 'Tab' ? 9 : key.charCodeAt(0),
    bubbles: true,
    cancelable: true,
    ...options,
  })
  await act(async () => {
    input.dispatchEvent(event)
    input.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...options }))
    await frame()
  })
  return event
}

describe.skipIf(!isCapricornRuntimeAvailable)('Desktop shortcut defaults with the runtime', () => {
  it.each([
    ['MacIntel', 'Mac OS X', { metaKey: true }],
    ['Win32', 'Windows NT 10.0', { ctrlKey: true }],
  ] as const)(
    'retains the bracket defaults with saved host settings on %s',
    async (platform, userAgent, modifier) => {
      vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform)
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
      const original = '- Parent\n- Selected\n- Next'
      const { input } = await mount(original)
      expect((await press(input, ']', modifier)).defaultPrevented).toBe(true)
      expect(session!.getMarkdown()).toBe('- Parent\n    - Selected\n- Next')
      expect((await press(input, '[', modifier)).defaultPrevented).toBe(true)
      expect(session!.getMarkdown()).toBe(original)
      expect((await press(input, '[')).defaultPrevented).toBe(false)
      expect((await press(input, ']')).defaultPrevented).toBe(false)
      expect(session!.getMarkdown()).toBe(original)
    },
  )
})
