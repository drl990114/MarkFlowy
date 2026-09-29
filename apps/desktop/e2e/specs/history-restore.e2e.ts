import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { $, browser } from '@wdio/globals'
import { cli, fixture, installChecks, openFile, replaceDocument, save, sha256,
  visibleContent, waitState } from '../helpers'

describe('local history restoration', () => {
  installChecks()
  it('restores a historical version as a dirty draft until explicitly saved', async () => {
    const original = 'Historical version to restore'
    const latest = 'Latest saved version'
    const path = await fixture('history-restore', original)
    await openFile(path, original)
    // Observe a real checkpoint created by opening the document, without seeding history internals.
    let versionId: string | undefined
    await browser.waitUntil(async () => {
      const entries = await cli<{ id: string; afterHash: string }[]>('history', 'list', path)
      versionId = entries.find((entry) => entry.afterHash === sha256(original))?.id
      return !!versionId
    }, { timeoutMsg: 'Opening the file did not create its initial history checkpoint' })
    await replaceDocument(path, latest)
    await save(path, latest)
    await $('button[aria-label="more"][aria-haspopup="menu"]').click()
    await $("//*[starts-with(@role, 'menuitem')][contains(., 'Local history')]").click()
    await $('[role="dialog"]').waitForDisplayed()
    await $(`[data-mf-history-entry-id="${versionId}"]`).click()
    const restore = $('[role="dialog"]').$('button=Restore this version')
    await restore.waitForEnabled()
    await restore.click()
    await $('[role="dialog"]').waitForExist({ reverse: true })
    await waitState(path, { dirty: true, contentSha256: sha256(original) })
    await visibleContent(original)
    assert.equal(await readFile(path, 'utf8'), latest)
    await save(path, original)
  })
})
