import { describe, expect, it, vi } from 'vitest'
import { getCapricornSelectionHeadingId } from './capricornHeadingViewport'
import type { CapricornHeading, CapricornRuntimeSession } from './capricornRuntimeAdapter'

function heading(id: string): CapricornHeading {
  return { id, level: 1, number: null, text: id, title: id }
}

function createSession(paths: Record<string, readonly number[]>, focus: string | null) {
  const getPath = vi.fn((key: string) => paths[key])
  const controller = {
    value: { selection: focus ? { focus: { key: focus } } : null, document: { getPath } },
  }
  const session = {
    query: (read: (value: typeof controller) => unknown) => read(controller),
  } as unknown as CapricornRuntimeSession
  return { session, getPath }
}

describe('Capricorn selection heading lookup', () => {
  it.each([
    { label: 'no selection', focus: null, path: [], expected: null },
    { label: 'intro before the first heading', focus: 'focus', path: [0, 0], expected: null },
    { label: 'heading text', focus: 'focus', path: [1, 0], expected: 'first' },
    { label: 'nested table text', focus: 'focus', path: [4, 2, 1, 0], expected: 'first' },
    { label: 'atomic block edge', focus: 'focus', path: [5], expected: 'second' },
    { label: 'deleted focus', focus: 'missing', path: [9, 0], expected: null },
    { label: 'document edge', focus: 'focus', path: [], expected: null },
  ])('resolves $label from the current model', ({ focus, path, expected }) => {
    const { session } = createSession({ first: [1], second: [5], focus: path }, focus)
    expect(getCapricornSelectionHeadingId(session, [heading('first'), heading('second')])).toBe(expected)
  })

  it('waits for a fresh heading snapshot when a searched heading has been removed', () => {
    const { session } = createSession({ first: [1], focus: [6, 0] }, 'focus')
    expect(getCapricornSelectionHeadingId(session, [heading('first'), heading('removed')])).toBeNull()
  })

  it('uses a logarithmic number of indexed path lookups for a large cached outline', () => {
    const headings = Array.from({ length: 4096 }, (_, index) => heading(`heading-${index}`))
    const paths = Object.fromEntries(headings.map(({ id }, index) => [id, [index * 2 + 1]]))
    const { session, getPath } = createSession({ ...paths, focus: [4096, 1, 0] }, 'focus')
    expect(getCapricornSelectionHeadingId(session, headings)).toBe('heading-2047')
    expect(getPath.mock.calls.length).toBeLessThanOrEqual(14)
  })

  it('returns no heading when the runtime query bridge or outline is unavailable', () => {
    const { session, getPath } = createSession({}, null)
    expect(getCapricornSelectionHeadingId(session, [])).toBeNull()
    expect(getPath).not.toHaveBeenCalled()
    expect(getCapricornSelectionHeadingId({} as CapricornRuntimeSession, [heading('first')])).toBeNull()
  })
})
