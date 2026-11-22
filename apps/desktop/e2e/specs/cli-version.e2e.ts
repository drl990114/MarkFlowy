import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { browser } from '@wdio/globals'
import { installChecks, root, sha256, status, waitState } from '../helpers'

describe('read-only CLI version queries', () => {
  installChecks()
  it('prints the running app version without opening a same-named file', async () => {
    const cwd = join(root, 'files')
    const path = join(cwd, 'version')
    const content = 'A file named version'
    await writeFile(path, content)
    const run = (...args: string[]) =>
      promisify(execFile)(process.env.MARKFLOWY_E2E_BINARY!, args, { cwd, timeout: 15_000 })
    assert.equal((await status(path)).open, false)
    const version = await browser.execute(() => window.__TAURI__.core.invoke<string>('plugin:app|version'))
    for (const arg of ['version', '--version', '-V']) {
      const { stdout, stderr } = await run(arg)
      assert.equal(stdout.trimEnd(), 'markflowy ' + version)
      assert.equal(stderr, '')
    }
    assert.equal((await status(path)).open, false)
    await run('file', 'open', 'version', '--window-id', 'main', '--wait', 'applied', '--json')
    await waitState(path, { open: true, ready: true, contentSha256: sha256(content) })
  })
})
