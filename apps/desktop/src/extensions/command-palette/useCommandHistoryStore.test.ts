import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COMMAND_HISTORY_KEY,
  normalizeCommandHistory,
  useCommandHistoryStore,
} from './useCommandHistoryStore'

beforeEach(() => {
  localStorage.clear()
  useCommandHistoryStore.setState({ recent: [] })
})

describe('command palette history', () => {
  it('deduplicates, keeps twenty entries and survives a fresh hydration', async () => {
    for (let i = 0; i < 25; i++) useCommandHistoryStore.getState().record(`command-${i}`)
    useCommandHistoryStore.getState().record('command-10')
    const recent = useCommandHistoryStore.getState().recent
    expect(recent).toHaveLength(20)
    expect(recent.slice(0, 3)).toEqual(['command-10', 'command-24', 'command-23'])
    expect(new Set(recent).size).toBe(20)
    const saved = localStorage.getItem(COMMAND_HISTORY_KEY)!
    useCommandHistoryStore.setState({ recent: [] })
    localStorage.setItem(COMMAND_HISTORY_KEY, saved)
    await useCommandHistoryStore.persist.rehydrate()
    expect(useCommandHistoryStore.getState().recent).toEqual(recent)
  })

  it('validates stored data and tolerates corrupt JSON and denied storage', async () => {
    expect(normalizeCommandHistory(['save', 42, null, '', 'save', 'open'])).toEqual([
      'save',
      'open',
    ])
    expect(normalizeCommandHistory({ recent: 'save' })).toEqual([])
    localStorage.setItem(COMMAND_HISTORY_KEY, '{broken')
    await useCommandHistoryStore.persist.rehydrate()
    expect(useCommandHistoryStore.getState().recent).toEqual([])
    const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    try {
      useCommandHistoryStore.getState().record('save')
      expect(useCommandHistoryStore.getState().recent).toEqual(['save'])
    } finally {
      denied.mockRestore()
    }
  })
})
