import { describe, expect, it, vi } from 'vitest'
import {
  loadThemeExtensionsIncrementally,
  type ScheduleThemeExtensionChunk,
  type ThemeExtension,
} from './themeExtensionScheduler'

const extension = (
  id: string,
  themeName = id,
  mode: 'dark' | 'light' = 'dark',
): ThemeExtension => ({
  id,
  path: `/themes/${id}`,
  pkg: JSON.stringify({ name: id }),
  script_text: `registerTheme({ name: ${JSON.stringify(themeName)}, mode: '${mode}' })`,
})

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('theme extension startup scheduling', () => {
  it('loads the current cached custom theme first even when it is last in the catalog', async () => {
    const extensions = [
      extension('one'),
      extension('same-name-light', 'Cached Midnight', 'light'),
      extension('package-current', 'Cached Midnight'),
    ]
    const loaded: string[] = []
    const scheduleChunk: ScheduleThemeExtensionChunk = async (task) => task()

    await loadThemeExtensionsIncrementally({
      extensions,
      currentTheme: { name: 'Cached Midnight', mode: 'dark' },
      loadExtension: (item) => loaded.push(item.id),
      onError: vi.fn(),
      scheduleChunk,
    })

    expect(loaded).toEqual(['package-current', 'one', 'same-name-light'])
  })

  it('loads each background extension in a separate yielded chunk', async () => {
    const extensions = [extension('current'), extension('one'), extension('two')]
    const loaded: string[] = []
    const chunks: (() => void)[] = []
    const scheduleChunk = vi.fn<ScheduleThemeExtensionChunk>(
      (task) =>
        new Promise((resolve) => {
          chunks.push(() => {
            task()
            resolve()
          })
        }),
    )

    const loading = loadThemeExtensionsIncrementally({
      extensions,
      currentTheme: { name: 'current', mode: 'dark' },
      loadExtension: (item) => loaded.push(item.id),
      onError: vi.fn(),
      scheduleChunk,
    })

    expect(loaded).toEqual(['current'])
    expect(chunks).toHaveLength(1)

    chunks.shift()?.()
    await flushMicrotasks()
    expect(loaded).toEqual(['current', 'one'])
    expect(chunks).toHaveLength(1)

    chunks.shift()?.()
    await loading
    expect(loaded).toEqual(['current', 'one', 'two'])
    expect(scheduleChunk).toHaveBeenCalledTimes(2)
  })

  it('isolates a broken current theme and continues loading background themes', async () => {
    const extensions = [extension('one'), extension('current'), extension('two')]
    const loaded: string[] = []
    const onError = vi.fn()

    await loadThemeExtensionsIncrementally({
      extensions,
      currentTheme: { name: 'current', mode: 'dark' },
      loadExtension: (item) => {
        if (item.id === 'current') throw new Error('broken theme')
        loaded.push(item.id)
      },
      onError,
      scheduleChunk: async (task) => task(),
    })

    expect(loaded).toEqual(['one', 'two'])
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(extensions[1], expect.any(Error))
  })
})
