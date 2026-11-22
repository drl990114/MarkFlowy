import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { installChecks, openFile, root, sha256, visibleContent, waitState } from '../helpers'

describe('hidden directory file watcher', () => {
  installChecks()
  it('keeps an explicitly opened document in nested hidden directories in sync', async () => {
    const directory = join(root, 'files', '.notes', '.archive', 'project[1]')
    const document = join(directory, 'daily.md')
    await mkdir(directory, { recursive: true })
    await writeFile(document, 'Initial hidden note')
    await openFile(document, 'Initial hidden note')

    await writeFile(document, 'External hidden note')
    await waitState(document, { dirty: false, conflict: false, contentSha256: sha256('External hidden note') })
    const replacement = join(directory, 'replacement.md')
    await writeFile(replacement, 'Replaced hidden note')
    await rename(replacement, document)
    await waitState(document, { dirty: false, conflict: false, contentSha256: sha256('Replaced hidden note') })
    await visibleContent('Replaced hidden note')
  })
})
