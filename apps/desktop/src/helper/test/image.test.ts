import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
  fetch: vi.fn(),
  invoke: vi.fn(),
  join: vi.fn(),
}))

vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({ folderData: null }),
  },
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: mocks.convertFileSrc,
  invoke: mocks.invoke,
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: mocks.join,
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: mocks.fetch,
}))

vi.mock('../filesys', () => ({
  FileResultCode: { Success: 0 },
}))

import { getImageUrlInTauri } from '../image'

describe('getImageUrlInTauri', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps encoded remote image URLs unchanged for the WebView', async () => {
    const source =
      'https://img.shields.io/badge/platforms-macOS%20%7C%20Linux-475569?style=flat-square'

    await expect(getImageUrlInTauri(source)).resolves.toBe(source)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('gives protocol-relative image URLs an HTTP protocol the WebView can load', async () => {
    const source = '//img.shields.io/badge/Rust-1.94-000000?style=flat-square'
    const expectedProtocol = location.protocol === 'http:' ? 'http:' : 'https:'

    await expect(getImageUrlInTauri(source)).resolves.toBe(`${expectedProtocol}${source}`)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
