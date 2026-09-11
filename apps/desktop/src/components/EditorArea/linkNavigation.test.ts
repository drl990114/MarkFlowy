import { beforeEach, expect, test, vi } from 'vitest'
import { beginLinkNavigation, navigateLinkFragment } from './linkNavigation'
import { setCapricornEditor } from './capricornEditorRegistry'
import type { CapricornRuntimeAdapter } from './capricornRuntimeAdapter'

beforeEach(() => {
  beginLinkNavigation()
  setCapricornEditor('target', undefined)
})
test('waits for the target editor and consumes the fragment once', async () => {
  const jump = vi.fn().mockResolvedValue(true)
  const pending = navigateLinkFragment('target', '中文')
  setCapricornEditor('target', {
    headings: { jumpToAnchor: jump },
  } as unknown as CapricornRuntimeAdapter)
  expect(await pending).toBe(true)
  expect(jump).toHaveBeenCalledExactlyOnceWith('中文')
})
test('a later navigation cancels a pending fragment', async () => {
  const pending = navigateLinkFragment('target', 'old')
  beginLinkNavigation()
  const jump = vi.fn().mockResolvedValue(true)
  setCapricornEditor('target', {
    headings: { jumpToAnchor: jump },
  } as unknown as CapricornRuntimeAdapter)
  expect(await pending).toBe(false)
  expect(jump).not.toHaveBeenCalled()
})

test.each([false, true])(
  'a remounted target editor receives the pending anchor (previous rejected: %s)',
  async (rejected) => {
    let settle: (result: boolean) => void = () => {}
    const oldJump = vi.fn(
      () =>
        new Promise<boolean>((resolve, reject) => {
          settle = (result) => {
            if (rejected) reject(new Error('Disposed editor'))
            else resolve(result)
          }
        }),
    )
    setCapricornEditor('target', {
      headings: { jumpToAnchor: oldJump },
    } as unknown as CapricornRuntimeAdapter)
    const pending = navigateLinkFragment('target', 'heading')
    const newJump = vi.fn().mockResolvedValue(true)
    setCapricornEditor('target', {
      headings: { jumpToAnchor: newJump },
    } as unknown as CapricornRuntimeAdapter)
    settle(true)
    expect(await pending).toBe(true)
    expect(newJump).toHaveBeenCalledExactlyOnceWith('heading')
  },
)
