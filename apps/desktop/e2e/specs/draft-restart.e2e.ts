import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fixture, installChecks, openFile, persistedDraft, replaceDocument, root,
  sha256, visibleContent, waitState } from '../helpers'

describe('persisted draft across native process restart', () => {
  installChecks()
  const original = 'Original disk version survives restart'
  const draft = 'Unsaved draft recovered after restarting the app'
  if (process.env.MARKFLOWY_E2E_PHASE === 'persist') {
    it('persists the exact dirty draft before the native process exits', async () => {
      const path = await fixture('draft-restart', original)
      await openFile(path, original)
      await replaceDocument(path, draft)
      await persistedDraft(path, draft)
      assert.equal(await readFile(path, 'utf8'), original)
      const profile = JSON.parse(await readFile(join(root, 'native-profile.json'), 'utf8'))
      await writeFile(join(root, 'previous-pid'), String(profile.pid))
    })
  } else {
    it('recovers the unsaved draft in a new process without overwriting disk', async () => {
      assert.equal(process.env.MARKFLOWY_E2E_PHASE, 'recover')
      const profile = JSON.parse(await readFile(join(root, 'native-profile.json'), 'utf8'))
      assert.notEqual(String(profile.pid), await readFile(join(root, 'previous-pid'), 'utf8'))
      const path = join(root, 'files', 'draft-restart.md')
      // Do not open/refresh the file here: startup recovery must restore it by itself.
      await waitState(path, { open: true, active: true, ready: true, dirty: true,
        contentSha256: sha256(draft) })
      await visibleContent(draft)
      await persistedDraft(path, draft)
      assert.equal(await readFile(path, 'utf8'), original)
    })
  }
})
