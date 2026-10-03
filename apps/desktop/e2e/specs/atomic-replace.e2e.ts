import { rename, writeFile } from 'node:fs/promises'
import { fixture, installChecks, openFile, sha256, visibleContent, waitState } from '../helpers'

describe('watcher after atomic file replacement', () => {
  installChecks()
  it('reloads the replacement inode and keeps watching later writes', async () => {
    const path = await fixture('atomic-replace', 'Before replacement')
    await openFile(path, 'Before replacement')
    await writeFile(`${path}.replacement`, 'Atomically replaced')
    await rename(`${path}.replacement`, path)
    await waitState(path, { dirty: false, conflict: false, contentSha256: sha256('Atomically replaced') })
    await visibleContent('Atomically replaced')
    await writeFile(path, 'Still watched after replacement')
    await waitState(path, { dirty: false, conflict: false,
      contentSha256: sha256('Still watched after replacement') })
    await visibleContent('Still watched after replacement')
  })
})
