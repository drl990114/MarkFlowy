import { fixture, installChecks, openFile, replaceDocument, save, shortcut, waitState } from '../helpers'

describe('native save and reopen', () => {
  installChecks()
  it('saves through Cmd+S and reopens the exact bytes from disk', async () => {
    const path = await fixture('save-reopen', 'Original saved text')
    await openFile(path, 'Original saved text')
    await replaceDocument(path, 'Edited through the real editor')
    await save(path, 'Edited through the real editor')
    await shortcut('w')
    await waitState(path, { open: false })
    await openFile(path, 'Edited through the real editor')
  })
})
