import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { terminateProcessTree, waitForRequiredArtifacts } from './dev-desktop.mjs'

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

const isRunning = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

const readPid = (stream) =>
  new Promise((resolvePid, rejectPid) => {
    let output = ''

    const onData = (chunk) => {
      output += chunk.toString()
      const newlineIndex = output.indexOf('\n')
      if (newlineIndex === -1) return

      stream.off('data', onData)
      const pid = Number(output.slice(0, newlineIndex))
      if (Number.isInteger(pid)) resolvePid(pid)
      else rejectPid(new Error(`Invalid child PID: ${output}`))
    }

    stream.on('data', onData)
    stream.once('error', rejectPid)
  })

test(
  'terminateProcessTree stops descendants in separate process groups',
  { timeout: 10_000 },
  async (t) => {
    const nestedProcessSource = `
    const { spawn } = require('node:child_process')
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    })
    process.stdout.write(String(child.pid) + '\\n')
    setInterval(() => {}, 1000)
  `

    const rootProcess = spawn(process.execPath, ['-e', nestedProcessSource], {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    const descendantPid = await readPid(rootProcess.stdout)

    t.after(() => {
      for (const pid of [descendantPid, rootProcess.pid]) {
        if (pid && isRunning(pid)) process.kill(pid, 'SIGKILL')
      }
    })

    assert.equal(isRunning(rootProcess.pid), true)
    assert.equal(isRunning(descendantPid), true)

    await terminateProcessTree(rootProcess.pid, { forceKillWaitMs: 1_000, gracePeriodMs: 250 })

    assert.equal(isRunning(rootProcess.pid), false)
    assert.equal(isRunning(descendantPid), false)
  },
)

test('waitForRequiredArtifacts ignores stale outputs that are cleaned and rebuilt', async (t) => {
  const artifactDirectory = await mkdtemp(join(tmpdir(), 'markflowy-dev-artifacts-'))
  const entryArtifact = join(artifactDirectory, 'index.js')
  const dependencyArtifact = join(artifactDirectory, 'styles.js')

  t.after(() => rm(artifactDirectory, { force: true, recursive: true }))

  await Promise.all([
    writeFile(entryArtifact, 'stale entry'),
    writeFile(dependencyArtifact, 'stale dependency'),
  ])

  const waitForArtifacts = waitForRequiredArtifacts(() => false, {
    artifacts: [entryArtifact, dependencyArtifact],
    pollIntervalMs: 5,
    stabilityMs: 80,
    timeoutMs: 1_000,
  })

  await delay(20)
  await Promise.all([unlink(entryArtifact), unlink(dependencyArtifact)])
  await delay(20)
  await writeFile(entryArtifact, 'rebuilt entry')
  await delay(20)
  await writeFile(dependencyArtifact, 'rebuilt dependency')

  await waitForArtifacts
  assert.equal(existsSync(entryArtifact), true)
  assert.equal(existsSync(dependencyArtifact), true)
})
