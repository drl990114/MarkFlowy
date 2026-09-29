import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fixture, installChecks, openFile, replaceDocument, save, sha256, switchMode,
  visibleContent, waitState } from '../helpers'

describe('unsaved content across editor modes', () => {
  installChecks()
  it('retains the same dirty draft in source, preview and WYSIWYG', async () => {
    const path = await fixture('switch-modes', 'Saved mode baseline')
    const draft = 'Unsaved content survives every mode'
    await openFile(path, 'Saved mode baseline')
    await replaceDocument(path, draft)
    for (const mode of ['sourceCode', 'preview', 'wysiwyg'] as const) {
      await switchMode(mode, path)
      await waitState(path, { dirty: true, contentSha256: sha256(draft) })
      await visibleContent(draft)
      assert.equal(await readFile(path, 'utf8'), 'Saved mode baseline')
    }
    await save(path, draft)
  })
})
