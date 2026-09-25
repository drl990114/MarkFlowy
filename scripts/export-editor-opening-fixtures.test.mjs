import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  createEditorOpeningFixture,
  EDITOR_OPENING_FIXTURES,
  EDITOR_OPENING_FIXTURE_BYTES,
} from '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts'
import {
  exportEditorOpeningFixtures,
  selectEditorOpeningFixtures,
} from './export-editor-opening-fixtures.mjs'

test('exports every ordinary fixture as an exact, deterministic file', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'markflowy-opening-fixtures-'))
  try {
    const results = await exportEditorOpeningFixtures({ outputDir })
    assert.deepEqual(
      results.map((result) => result.fixture),
      selectEditorOpeningFixtures('ordinary'),
    )
    for (const result of results) {
      const content = await readFile(result.path)
      assert.equal(content.byteLength, EDITOR_OPENING_FIXTURE_BYTES)
      assert.equal(
        result.sha256,
        createHash('sha256').update(createEditorOpeningFixture(result.fixture)).digest('hex'),
      )
      assert.equal(result.stress, EDITOR_OPENING_FIXTURES[result.fixture].stress)
    }
    await assert.rejects(() => exportEditorOpeningFixtures({ outputDir }), /EEXIST/)
    const overwritten = await exportEditorOpeningFixtures({ outputDir, force: true })
    assert.deepEqual(
      overwritten.map((result) => result.sha256),
      results.map((result) => result.sha256),
    )
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

test('rejects unknown fixtures and missing output directories', async () => {
  assert.equal(
    selectEditorOpeningFixtures('all').length,
    Object.keys(EDITOR_OPENING_FIXTURES).length,
  )
  assert.throws(() => selectEditorOpeningFixtures('missing'), /Unknown fixture/)
  await assert.rejects(
    () => exportEditorOpeningFixtures({ outputDir: '' }),
    /explicit output directory/,
  )
})

test('exports a 200 KiB CJK startup fixture without splitting UTF-8 characters', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'markflowy-startup-fixtures-'))
  try {
    const [result] = await exportEditorOpeningFixtures({ outputDir, selected: 'cjk', byteLength: 200 * 1024 })
    const content = await readFile(result.path)
    assert.equal(content.byteLength, 200 * 1024)
    assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(content), createEditorOpeningFixture('cjk', 200 * 1024))
    assert.equal(result.sha256, createHash('sha256').update(content).digest('hex'))
    for (const byteLength of [-1, 1.5, Number.NaN, 65 * 1024 * 1024]) {
      await assert.rejects(() => exportEditorOpeningFixtures({ outputDir, byteLength }), /byte count/)
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})
