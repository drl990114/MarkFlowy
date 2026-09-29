import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { $ } from '@wdio/globals'
import { fixture, installChecks, openFile, persistedDraft, replaceDocument, sha256,
  visibleContent, waitState } from '../helpers'

describe('local draft versus external edit', () => {
  installChecks()
  it('preserves both versions and presents the conflict to the user', async () => {
    const path = await fixture('dirty-conflict', 'Original shared baseline')
    await openFile(path, 'Original shared baseline')
    const local = 'My unsaved local draft'
    const external = 'A different edit on disk'
    await replaceDocument(path, local)
    await writeFile(path, external)
    await waitState(path, { dirty: true, conflict: true, contentSha256: sha256(local) })
    await visibleContent(local)
    await $('[role="alert"]').waitForDisplayed()
    await $('[role="alert"] button=Update').waitForDisplayed()
    await $('[role="alert"] button=Overwrite').waitForDisplayed()
    await persistedDraft(path, local)
    assert.equal(await readFile(path, 'utf8'), external)
  })
})
