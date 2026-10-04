import { describe, expect, it } from 'vitest'
import { persistentDiskRevision } from './draftDiskRevision'

const hash = '327fab30f32552d2654cb0c32cfd481c3d148d9cf378aab6aded5a4d23ebb8e1'

describe('persisted draft disk revisions', () => {
  it.each([
    `existing:1:2:136:1791132580162384580:sha256:${hash}`,
    `existing:136:1791132580162384580:sha256:${hash}`,
  ])('retains every stable disk field in %s', (stable) => {
    expect(persistentDiskRevision(`${stable}:path-generation:7:file-generation:2`)).toBe(stable)
    expect(persistentDiskRevision(`${stable}:path-generation:0:file-generation:0`)).toBe(stable)
    expect(persistentDiskRevision(stable)).toBe(stable)
  })

  it.each([
    undefined,
    '',
    'r1',
    'missing:generation:7',
    `existing:1:2:136:1791132580162384580:sha256:${hash}:path-generation:7`,
    `existing:1:2:136:1791132580162384580:sha256:${hash}:path-generation:7:file-generation:2:future:1`,
    'existing:1:2:136:1791132580162384580:sha256:invalid:path-generation:7:file-generation:2',
  ])('preserves unsupported revisions without weakening comparison: %s', (revision) => {
    expect(persistentDiskRevision(revision)).toBe(revision)
  })
})
