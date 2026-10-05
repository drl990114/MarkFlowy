import { beforeEach, describe, expect, it } from 'vitest'
import { readThemeDrafts, themeDraftKey, writeThemeDraft } from './drafts'

beforeEach(() => sessionStorage.clear())
describe('theme session storage', () => {
  it('recovers valid sessions without deleting unreadable drafts', () => {
    const brokenKey = themeDraftKey('broken')
    sessionStorage.setItem(brokenKey, '{')
    writeThemeDraft(themeDraftKey('paper'), {
      version: 1,
      document: {
        version: 1,
        id: 'paper',
        name: 'Paper',
        variants: [{ id: 'light', name: 'Light', mode: 'light', tokens: {} }],
      },
      variantId: 'removed-variant',
      json: '{ unfinished',
    })
    const drafts = readThemeDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].session.variantId).toBe('light')
    expect(drafts[0].session.json).toBe('{ unfinished')
    expect(sessionStorage.getItem(brokenKey)).toBe('{')
  })
})
