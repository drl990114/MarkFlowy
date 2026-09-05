import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  assertRustToolchainAvailable,
  terminateProcessTree,
  waitForRequiredArtifacts,
  withCargoOnPath,
} from './dev-desktop.mjs'

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

test('withCargoOnPath adds the standard rustup proxy directory when needed', () => {
  const homeDirectory = '/test/home'
  const cargoBin = join(homeDirectory, '.cargo', 'bin')
  const cargoExecutable = join(cargoBin, 'cargo')
  const rustcExecutable = join(cargoBin, 'rustc')
  const env = withCargoOnPath(
    { PATH: '/usr/local/bin:/usr/bin' },
    {
      homeDirectory,
      pathDelimiter: ':',
      pathExists: (path) => path === cargoExecutable || path === rustcExecutable,
      platform: 'darwin',
    },
  )

  assert.equal(env.PATH, `${cargoBin}:/usr/local/bin:/usr/bin`)
})

test('withCargoOnPath preserves an existing Cargo resolution', () => {
  const initialEnvironment = { CARGO_HOME: '/alternate/cargo', PATH: '/toolchain/bin:/usr/bin' }
  const env = withCargoOnPath(initialEnvironment, {
    homeDirectory: '/test/home',
    pathDelimiter: ':',
    pathExists: (path) => ['/toolchain/bin/cargo', '/toolchain/bin/rustc'].includes(path),
    platform: 'darwin',
  })

  assert.deepEqual(env, initialEnvironment)
})

test('assertRustToolchainAvailable rejects an incomplete rustup toolchain', () => {
  const commands = []
  const runCommand = (command) => {
    commands.push(command)
    if (command === 'cargo') return { status: 0, stdout: 'cargo 1.96.0\n', stderr: '' }

    return {
      status: 1,
      stdout: '',
      stderr: "error: missing manifest in toolchain '1.96-aarch64-apple-darwin'",
    }
  }

  assert.throws(
    () => assertRustToolchainAvailable({ PATH: '/toolchain/bin' }, { runCommand }),
    /Rust compiler is unavailable or incomplete.*missing manifest/s,
  )
  assert.deepEqual(commands, ['cargo', 'rustc'])
})

test('assertRustToolchainAvailable accepts cargo and rustc with a host triple', () => {
  const runCommand = (command) =>
    command === 'cargo'
      ? { status: 0, stdout: 'cargo 1.96.0\n', stderr: '' }
      : { status: 0, stdout: 'rustc 1.96.0\nhost: aarch64-apple-darwin\n', stderr: '' }

  assert.doesNotThrow(() =>
    assertRustToolchainAvailable({ PATH: '/toolchain/bin' }, { runCommand }),
  )
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
