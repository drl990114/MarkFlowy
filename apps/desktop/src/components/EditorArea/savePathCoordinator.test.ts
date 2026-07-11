import { describe, expect, it, vi } from 'vitest'
import { FILE_MUTATION_QUEUE_KEY, SavePathCoordinator } from './savePathCoordinator'

describe('SavePathCoordinator filesystem mutations', () => {
  it('keeps a Save As queued until the explorer UI commit completes', async () => {
    const coordinator = new SavePathCoordinator()
    const events: string[] = []
    let finishUiCommit: (() => void) | undefined

    const explorerMutation = coordinator.runFileMutation(async () => {
      events.push('explorer:backend')
      await new Promise<void>((resolve) => {
        finishUiCommit = resolve
      })
      events.push('explorer:ui-commit')
    })
    const saveAs = coordinator.runExclusive(FILE_MUTATION_QUEUE_KEY, 'save-source', async () => {
      events.push('save-as:start')
    })

    await vi.waitFor(() => expect(events).toEqual(['explorer:backend']))
    finishUiCommit?.()
    await Promise.all([explorerMutation, saveAs])

    expect(events).toEqual(['explorer:backend', 'explorer:ui-commit', 'save-as:start'])
  })
})
