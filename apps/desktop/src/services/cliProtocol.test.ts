import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CliError,
  cliReceipt,
  contentSha256,
  waitForCliFile,
  type CliFileState,
  type CliRequest,
} from './cliProtocol'

const nativeHash = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: nativeHash }))
afterEach(() => {
  vi.unstubAllGlobals()
})

const request = (patch: Partial<CliRequest> = {}): CliRequest => ({
  protocolVersion: 1,
  requestId: 'cli-test',
  operation: 'open',
  path: '/notes.md',
  windowId: 'main',
  commandId: null,
  preview: false,
  waitFor: 'applied',
  expectedSha256: 'new',
  output: null,
  format: null,
  overwrite: false,
  deadline: Date.now() + 1000,
  ...patch,
})
const state = (patch: Partial<CliFileState> = {}): CliFileState => ({
  path: '/notes.md',
  windowId: 'main',
  fileId: 'file',
  open: true,
  active: true,
  visible: true,
  ready: true,
  mode: 'preview',
  dirty: false,
  conflict: false,
  contentSha256: 'old',
  expectedSha256: 'new',
  applied: false,
  ...patch,
})

describe('CLI completion protocol', () => {
  it('waits for the live revision and rechecks content after a rendering opportunity', async () => {
    let current = state()
    let frames = 0
    let reapply = false
    const result = await waitForCliFile(request(), {
      inspect: async () => {
        const observed = current
        if (reapply) {
          current = state({ contentSha256: 'new', applied: true })
          reapply = false
        }
        return observed
      },
      handle: () => undefined,
      refresh: async () => {
        current = state({ contentSha256: 'new', applied: true })
      },
      frame: async () => {
        frames++
        if (frames === 1) {
          current = state({ contentSha256: 'changed', applied: false })
          reapply = true
        }
      },
    })
    expect(frames).toBe(2)
    expect(result.contentSha256).toBe('new')
  })

  it('does not confuse open/ready with visible or applied', async () => {
    const result = await cliReceipt(request({ deadline: Date.now() + 25 }), async () => ({
      code: 'content_applied',
      result: await waitForCliFile(request({ deadline: Date.now() + 20 }), {
        inspect: async () => state({ visible: false, applied: true }),
        handle: () => undefined,
        refresh: vi.fn(),
        frame: vi.fn(),
      }),
    }))
    expect(result).toMatchObject({ ok: false, code: 'timeout', requestId: 'cli-test' })
  })

  it('protects dirty/conflicting content and does not call refresh', async () => {
    const refresh = vi.fn()
    await expect(
      waitForCliFile(request(), {
        inspect: async () => state({ conflict: true, dirty: true }),
        handle: () => undefined,
        refresh,
        frame: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'content_conflict' })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('reports load failure and closed targets instead of stale success', async () => {
    for (const [patch, code] of [
      [{ error: 'Runtime failed' }, 'editor_failed'],
      [{ open: false }, 'file_not_open'],
    ] as const) {
      await expect(
        waitForCliFile(request(), {
          inspect: async () => state(patch),
          handle: () => undefined,
          refresh: vi.fn(),
          frame: vi.fn(),
        }),
      ).rejects.toMatchObject({ code })
    }
  })

  it('sets preview on the selected instance and waits for its committed mode', async () => {
    let mode = 'sourceCode'
    const preview = vi.fn(() => {
      mode = 'preview'
    })
    const result = await waitForCliFile(request({ preview: true }), {
      inspect: async () => state({ mode, applied: true, contentSha256: 'new' }),
      handle: () => ({ inspect: vi.fn(), readContent: vi.fn(), preview, render: vi.fn() }),
      refresh: vi.fn(),
      frame: vi.fn(),
    })
    expect(preview).toHaveBeenCalledOnce()
    expect(result.mode).toBe('preview')
  })

  it('rejects expired/unsupported requests before performing side effects', async () => {
    const run = vi.fn()
    expect(await cliReceipt(request({ deadline: 0 }), run)).toMatchObject({
      ok: false,
      code: 'timeout',
    })
    expect(await cliReceipt(request({ protocolVersion: 99 }), run)).toMatchObject({
      ok: false,
      code: 'unsupported_protocol',
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('preserves structured failure evidence', async () => {
    expect(
      await cliReceipt(request(), async () => {
        throw new CliError('export_failed', 'Permission denied', { output: '/no.html' })
      }),
    ).toMatchObject({
      ok: false,
      code: 'export_failed',
      message: 'Permission denied',
      result: { output: '/no.html' },
    })
    expect(await contentSha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('bounds a stalled GUI handler so later requests are not permanently blocked', async () => {
    const stalled = request({ deadline: Date.now() + 20 })
    expect(await cliReceipt(stalled, () => new Promise(() => {}))).toMatchObject({
      ok: false,
      code: 'timeout',
    })
    expect(
      await cliReceipt(request(), async () => ({ code: 'file_status', result: {} })),
    ).toMatchObject({ ok: true })
  })

  it('uses the existing native digest when Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined)
    nativeHash.mockResolvedValue('native-digest')
    expect(await contentSha256('文档')).toBe('native-digest')
    expect(nativeHash).toHaveBeenCalledWith('cli_hash_content', { content: '文档' })
  })
})
