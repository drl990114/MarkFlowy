import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { $ } from '@wdio/globals'
import { externalSource, openShortenedSource, visibleSource } from '../fixtures/source-edit'
import { fixture, installChecks, openFile, persistedDraft, replaceDocument, sha256,
  visibleContent, waitState } from '../helpers'

describe('local draft versus external edit', () => {
  installChecks()
  it('loads the disk version into WYSIWYG and source when the user clicks Update', async () => {
    const path = await fixture('dirty-conflict', 'Original shared baseline')
    await openFile(path, 'Original shared baseline')
    const local = 'My unsaved local draft'
    const external = 'A different edit on disk'
    await replaceDocument(path, local)
    await writeFile(path, external)
    await waitState(path, { dirty: true, conflict: true, contentSha256: sha256(local) })
    await visibleContent(local)
    await $('[role="alert"]').waitForDisplayed()
    await $('[role="alert"]').$('button=Update').waitForDisplayed()
    await $('[role="alert"]').$('button=Overwrite').waitForDisplayed()
    await persistedDraft(path, local)
    assert.equal(await readFile(path, 'utf8'), external)
    await $('[role="alert"]').$('button=Update').click()
    await waitState(path, { ready: true, dirty: false, conflict: false, contentSha256: sha256(external) })
    assert.equal(await $('[data-editor-active="true"] [data-cap-content]').getText(), external)
    assert.equal(await readFile(path, 'utf8'), external)

    const source = await openShortenedSource('dirty-conflict-source')
    await writeFile(source.path, externalSource)
    await waitState(source.path, { dirty: true, conflict: true, contentSha256: sha256(source.local) })
    await visibleSource(source.local)
    await persistedDraft(source.path, source.local)
    assert.equal(await readFile(source.path, 'utf8'), externalSource)
    const update = $('[role="alert"]').$('button=Update')
    await update.waitForDisplayed()
    await update.click()
    await waitState(source.path, {
      ready: true, dirty: false, conflict: false, contentSha256: sha256(externalSource),
    })
    await visibleSource(externalSource)
    assert.equal(await readFile(source.path, 'utf8'), externalSource)
  })
})
