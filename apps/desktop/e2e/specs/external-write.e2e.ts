import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { externalSource, openShortenedSource, visibleSource } from '../fixtures/source-edit'
import { fixture, installChecks, openFile, save, sha256, visibleContent, waitState } from '../helpers'

describe('native file watcher', () => {
  installChecks()
  it('reloads clean WYSIWYG and saved source documents through the watcher', async () => {
    const path = await fixture('external-write', 'Initial disk content')
    await openFile(path, 'Initial disk content')
    const updated = 'Updated outside MarkFlowy'
    await writeFile(path, updated)
    await waitState(path, { dirty: false, conflict: false, contentSha256: sha256(updated) })
    await visibleContent(updated)

    const source = await openShortenedSource('external-write-saved-source')
    await save(source.path, source.local)
    await waitState(source.path, { dirty: false, conflict: false })
    await writeFile(source.path, externalSource)
    await waitState(source.path, {
      ready: true, dirty: false, conflict: false, contentSha256: sha256(externalSource),
    })
    await visibleSource(externalSource)
    assert.equal(await readFile(source.path, 'utf8'), externalSource)
  })
})
