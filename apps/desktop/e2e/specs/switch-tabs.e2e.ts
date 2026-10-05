import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fixture, installChecks, openFile, replaceDocument, save, selectTab, sha256,
  visibleContent, waitState } from '../helpers'

describe('independent tab ownership', () => {
  installChecks()
  it('keeps A and B content and save targets separate during rapid switching', async () => {
    const a = await fixture('tab-A', 'Original A')
    const b = await fixture('tab-B', 'Original B')
    const aState = await openFile(a, 'Original A')
    await replaceDocument(a, 'Dirty draft A')
    const bState = await openFile(b, 'Original B')
    await replaceDocument(b, 'Dirty draft B')
    assert.ok(aState.fileId && bState.fileId)
    for (let cycle = 0; cycle < 4; cycle++) {
      await selectTab(aState.fileId)
      await selectTab(bState.fileId)
    }
    await selectTab(aState.fileId)
    await waitState(a, { active: true, dirty: true, contentSha256: sha256('Dirty draft A') })
    await visibleContent('Dirty draft A')
    await save(a, 'Dirty draft A')
    assert.equal(await readFile(b, 'utf8'), 'Original B')
    await selectTab(bState.fileId)
    await waitState(b, { active: true, dirty: true, contentSha256: sha256('Dirty draft B') })
    await visibleContent('Dirty draft B')
    await save(b, 'Dirty draft B')
    assert.equal(await readFile(a, 'utf8'), 'Dirty draft A')
  })
})
