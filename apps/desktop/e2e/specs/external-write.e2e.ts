import { writeFile } from 'node:fs/promises'
import { fixture, installChecks, openFile, sha256, visibleContent, waitState } from '../helpers'

describe('native file watcher', () => {
  installChecks()
  it('reloads an external in-place write without an active refresh', async () => {
    const path = await fixture('external-write', 'Initial disk content')
    await openFile(path, 'Initial disk content')
    const updated = 'Updated outside MarkFlowy'
    await writeFile(path, updated)
    await waitState(path, { dirty: false, conflict: false, contentSha256: sha256(updated) })
    await visibleContent(updated)
  })
})
