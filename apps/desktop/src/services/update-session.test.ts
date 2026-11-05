import { beforeEach, describe, expect, it, vi } from 'vitest'
import { preserveUpdateSession, listenForUpdateSession } from './update-session'
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), emitTo: vi.fn(), listen: vi.fn(), getAllWindows: vi.fn(), stop: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ emitTo: mocks.emitTo, listen: mocks.listen }))
vi.mock('@tauri-apps/api/window', () => ({ getAllWindows: mocks.getAllWindows }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getAllWindows.mockResolvedValue([{ label: 'main' }, { label: 'main_two' }, { label: 'settings' }])
  mocks.listen.mockResolvedValue(mocks.stop)
})
describe('update session barrier', () => {
  it('commits the manifest only after all editor windows saved', async () => {
    const saving = preserveUpdateSession('main')
    await vi.waitFor(() => expect(mocks.emitTo).toHaveBeenCalledTimes(2))
    const receive = mocks.listen.mock.calls[0][1]
    const { id } = mocks.emitTo.mock.calls[0][2]
    receive({ payload: { id: 'old', label: 'main' } })
    receive({ payload: { id, label: 'settings' } })
    receive({ payload: { id, label: 'main' } })
    expect(mocks.invoke).not.toHaveBeenCalled()
    receive({ payload: { id, label: 'main_two' } })
    await saving
    expect(mocks.invoke).toHaveBeenCalledWith('preserve_update_session', { labels: ['main', 'main_two'] })
    expect(mocks.stop).toHaveBeenCalledOnce()
  })
  it('rejects a failed window save without committing a restore manifest', async () => {
    const saving = preserveUpdateSession('main')
    const rejected = expect(saving).rejects.toThrow('disk full')
    await vi.waitFor(() => expect(mocks.emitTo).toHaveBeenCalledTimes(2))
    const { id } = mocks.emitTo.mock.calls[0][2]
    mocks.listen.mock.calls[0][1]({ payload: { id, label: 'main_two', error: 'disk full' } })
    await rejected
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.stop).toHaveBeenCalledOnce()
  })
  it('acknowledges only after the renderer flush completes', async () => {
    let finish!: () => void
    const flush = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    await listenForUpdateSession('main_two', flush)
    const response = mocks.listen.mock.calls[0][1]({ payload: { id: 'request', replyTo: 'main' } })
    expect(mocks.emitTo).not.toHaveBeenCalled()
    finish()
    await response
    expect(mocks.emitTo).toHaveBeenCalledWith('main', 'mf-update-session-response', {
      id: 'request', label: 'main_two', error: undefined,
    })
  })
})
