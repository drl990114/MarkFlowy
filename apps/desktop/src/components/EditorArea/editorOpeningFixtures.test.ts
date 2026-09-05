import { describe, expect, it } from 'vitest'
import {
  createEditorOpeningFixture,
  EDITOR_OPENING_FIXTURES,
  EDITOR_OPENING_FIXTURE_BYTES,
  summarizeOpeningDurations,
  type EditorOpeningFixtureName,
} from './editorOpeningFixtures'

describe('editor opening fixtures', () => {
  it.each(Object.keys(EDITOR_OPENING_FIXTURES) as EditorOpeningFixtureName[])(
    '%s is reproducible, valid UTF-8 and exactly 2 MiB',
    (name) => {
      const source = createEditorOpeningFixture(name)
      const bytes = new TextEncoder().encode(source)
      expect(bytes.byteLength).toBe(EDITOR_OPENING_FIXTURE_BYTES)
      expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toBe(source)
      expect(createEditorOpeningFixture(name)).toBe(source)
    },
  )

  it('keeps the reviewed ordinary mixture in the mandatory acceptance group', () => {
    expect(EDITOR_OPENING_FIXTURES['mixed-ordinary'].stress).toBe(false)
    expect(createEditorOpeningFixture('mixed-ordinary')).toContain(
      'Paragraph with **strong** and [link]',
    )
    expect(EDITOR_OPENING_FIXTURES['short-blocks'].stress).toBe(true)
  })

  it('keeps ordinary table coverage distinct from dense table pressure', () => {
    const ordinary = EDITOR_OPENING_FIXTURES.tables
    const dense = EDITOR_OPENING_FIXTURES['dense-tables']
    expect(ordinary.stress).toBe(false)
    expect(dense.stress).toBe(true)
    expect(ordinary.unit).toContain('Ordinary prose surrounding')
    expect(ordinary.unit.match(/^\| Item/gm)?.length).toBe(8)
    expect(dense.unit).not.toContain('Ordinary prose surrounding')
  })

  it('does not split multibyte code points when filling arbitrary byte lengths', () => {
    for (let size = 0; size < 50; size += 1) {
      const text = createEditorOpeningFixture('cjk', size)
      const encoded = new TextEncoder().encode(text)
      expect(encoded.byteLength).toBe(size)
      expect(new TextDecoder().decode(encoded)).toBe(text)
    }
    expect(() => createEditorOpeningFixture('cjk', -1)).toThrow(RangeError)
  })

  it('reports nearest-rank percentiles without mutating or discarding cold samples', () => {
    const values = [2_000, ...Array.from({ length: 29 }, (_, i) => i + 1)]
    expect(summarizeOpeningDurations(values)).toEqual({ samples: 30, p50: 15, p95: 29, max: 2_000 })
    expect(values[0]).toBe(2_000)
    expect(() => summarizeOpeningDurations([])).toThrow(RangeError)
  })
})
