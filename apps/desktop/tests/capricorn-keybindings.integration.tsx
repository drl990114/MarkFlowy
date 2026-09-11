import { act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { recordKey } from '@/router/Setting/KeyboardTable/record-key'
import {
  createCapricornKeybindingConfiguration,
  toCapricornShortcut,
} from '@/components/EditorArea/capricornKeybindings'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
  type CapricornRuntimeSession,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from '@/components/EditorArea/capricornRuntimeDom'
import { createKeybindingsHandler } from '@/helper/bindkeys'
import { shortcutString } from '@/commands/keybindingKeys'
import { keybindingProblem } from '@/commands/keybindingValidation'
import { getDefaultKeybindings } from '@/commands/keybindingCatalog'

let session: CapricornRuntimeSession | undefined
let adapter: CapricornRuntimeAdapter | undefined
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
afterEach(async () => {
  await act(async () => adapter?.destroy())
  adapter = undefined
  session = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function platform(name: string) {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(name)
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(name)
  vi.stubGlobal('process', { ...process, platform: name === 'Win32' ? 'win32' : 'linux' })
}
async function mounted(keys: string | readonly string[]) {
  const host = document.createElement('div')
  document.body.append(host)
  const configuration = createCapricornKeybindingConfiguration({ toggleH2: keys }, true)
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container: host,
      createRuntime: (container, options) => {
        session = (createCapricornRuntime as CapricornRuntimeFactory)(container, options)
        return session
      },
      options: { markdown: 'Body', keybindingConfiguration: configuration },
      onChange: () => {},
    })
    session!.focus()
    await frame()
  })
  expect(session!.keybindings!.validateConfiguration(configuration).ok).toBe(true)
  return getCapricornRuntimeInput(host)!
}
describe.each(['Win32', 'Linux x86_64'])(
  'host shortcuts with the current Capricorn source on %s',
  (name) => {
    it('dispatches either alternative binding and leaves native copy untouched', async () => {
      platform(name)
      const input = await mounted(['Ctrl-2', 'Ctrl-3'])
      const press = async (key: string) => {
        const event = new KeyboardEvent('keydown', {
          key,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
        await act(async () => {
          input.dispatchEvent(event)
          await frame()
        })
        return event
      }
      await press('2')
      expect(session!.getMarkdown()).toBe('## Body')
      await act(async () => {
        session!.commands.undo()
        await frame()
      })
      expect(session!.getMarkdown()).toBe('Body')
      await press('3')
      expect(session!.getMarkdown()).toBe('## Body')
      expect((await press('c')).defaultPrevented).toBe(false)
    })
    it.each([
      ['US Shift+1 control', '!', 'Digit1', 49],
      ['French Shift+1', '1', 'Digit1', 49],
      ['German Shift+7', '/', 'Digit7', 55],
    ])('round trips %s through Capricorn', async (label, key, code, keyCode) => {
      platform(name)
      const init = {
        key: key as string,
        code: code as string,
        keyCode: keyCode as number,
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }
      const recorded = recordKey(new KeyboardEvent('keydown', init))!
      const shortcut = shortcutString(recorded)
      const input = await mounted(shortcut)
      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', init))
        await frame()
      })
      expect(
        session!.getMarkdown(),
        `${label}: ${shortcut} -> ${toCapricornShortcut(shortcut)}`,
      ).toBe('## Body')
    })
    it('reports a semantic digit overlapping a physical numpad binding', () => {
      platform(name)
      const bindings = getDefaultKeybindings('linux')
        .filter((rule) => ['app_save', 'editor_toggleH2'].includes(rule.command))
        .map((rule) => ({
          ...rule,
          keys: ['CommandOrCtrl', rule.command === 'app_save' ? '1' : '[Numpad1]'],
        }))
      const save = vi.fn()
      createKeybindingsHandler({ 'mod-1': save })(
        new KeyboardEvent('keydown', { key: '1', code: 'Numpad1', ctrlKey: true }),
      )
      expect(save).toHaveBeenCalledOnce()
      expect(
        keybindingProblem(bindings, 'editor_toggleH2.default', ['CommandOrCtrl', '[Numpad1]']),
      ).toMatchObject({ type: 'conflict' })
    })
    it('resolves portable and explicit modifiers consistently', async () => {
      platform(name)
      expect(toCapricornShortcut('mod-Ctrl-Shift-1')).toBe('mod+Shift+1')
      const input = await mounted('mod-Ctrl-Shift-1')
      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: '1',
            code: 'Digit1',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          }),
        )
        await frame()
      })
      expect(session!.getMarkdown()).toBe('## Body')
    })
    it('leaves AltGraph to native input without cancelling native input', async () => {
      platform(name)
      const input = await mounted('Ctrl-Alt-[Numpad1]')
      const event = new KeyboardEvent('keydown', {
        key: '1',
        code: 'Numpad1',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'getModifierState', {
        value: (key: string) => key === 'AltGraph',
      })
      const appCommand = vi.fn()
      createKeybindingsHandler({ 'Ctrl-Alt-[Numpad1]': appCommand })(event)
      expect(appCommand).not.toHaveBeenCalled()
      await act(async () => {
        input.dispatchEvent(event)
        await frame()
      })
      expect(session!.getMarkdown()).toBe('Body')
      expect(event.defaultPrevented).toBe(false)
      const beforeInput = vi.fn()
      input.addEventListener('beforeinput', beforeInput)
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: '@',
          bubbles: true,
          cancelable: true,
        }),
      )
      expect(beforeInput).toHaveBeenCalledOnce()
      const outside = document.createElement('textarea')
      document.body.append(outside)
      const outsideKey = vi.fn()
      outside.addEventListener('keydown', outsideKey)
      const outsideEvent = new KeyboardEvent('keydown', {
        key: '@',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(outsideEvent, 'getModifierState', {
        value: (modifier: string) => modifier === 'AltGraph',
      })
      outside.dispatchEvent(outsideEvent)
      expect(outsideKey).toHaveBeenCalledOnce()
      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: '1',
            code: 'Numpad1',
            ctrlKey: true,
            altKey: true,
            bubbles: true,
            cancelable: true,
          }),
        )
        await frame()
      })
      expect(session!.getMarkdown()).toBe('## Body')
    })
  },
)
