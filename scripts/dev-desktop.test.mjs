import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  assertRustToolchainAvailable,
  runDevDesktop,
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

const observeWorker = (child, role) => {
  let output = ''
  let pendingLine = ''
  const workers = []
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.stdout.on('data', (chunk) => {
      output += chunk
      pendingLine += chunk
      const lines = pendingLine.split('\n')
      pendingLine = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('{')) continue
        const worker = JSON.parse(line)
        workers.push(worker)
        if (worker.role === role) resolve(worker)
      }
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.once('close', () => reject(new Error(`Worker ${role} did not start:\n${output}`)))
  })
  const closed = new Promise((resolve) => {
    child.once('close', (code, signal) => resolve({ code, signal, output, workers }))
  })
  return { ready, closed, workers }
}

const assertPortReleased = async (port) => {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}

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

test('assertRustToolchainAvailable rejects an incomplete rustup toolchain', async () => {
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

  await assert.rejects(
    () => assertRustToolchainAvailable({ PATH: '/toolchain/bin' }, { runCommand }),
    /Rust compiler is unavailable or incomplete.*missing manifest/s,
  )
  assert.deepEqual(commands, ['cargo', 'rustc'])
})

test('assertRustToolchainAvailable accepts cargo and rustc with a host triple', async () => {
  const runCommand = (command) =>
    command === 'cargo'
      ? { status: 0, stdout: 'cargo 1.96.0\n', stderr: '' }
      : { status: 0, stdout: 'rustc 1.96.0\nhost: aarch64-apple-darwin\n', stderr: '' }

  await assert.doesNotReject(() =>
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

test(
  'terminateProcessTree lets the coordinator finish graceful shutdown',
  { timeout: 10_000, skip: process.platform === 'win32' },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'markflowy-dev-shutdown-'))
    const marker = join(directory, 'shutdown.txt')
    const workerSource = `
    const { writeFileSync } = require('node:fs')
    process.on('SIGTERM', () => {
      writeFileSync(${JSON.stringify(marker)}, 'interrupted')
      process.exit(1)
    })
    process.on('message', () => {
      setTimeout(() => {
        writeFileSync(${JSON.stringify(marker)}, 'graceful')
        process.exit(0)
      }, 100)
    })
    process.send('ready')
  `
    const coordinator = spawn(
      process.execPath,
      [
        '-e',
        `
    const { spawn } = require('node:child_process')
    const worker = spawn(process.execPath, ['-e', ${JSON.stringify(workerSource)}], {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    })
    worker.on('message', () => console.log(worker.pid))
    worker.on('exit', () => process.exit(0))
    process.on('SIGTERM', () => worker.send('stop'))
  `,
      ],
      { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'inherit'] },
    )
    const workerPid = await readPid(coordinator.stdout)
    t.after(async () => {
      await terminateProcessTree(coordinator.pid, { gracePeriodMs: 100 })
      if (isRunning(workerPid)) process.kill(workerPid, 'SIGKILL')
      await rm(directory, { recursive: true, force: true })
    })

    await terminateProcessTree(coordinator.pid, { gracePeriodMs: 500 })

    assert.equal(await readFile(marker, 'utf8'), 'graceful')
    assert.equal(isRunning(coordinator.pid), false)
    assert.equal(isRunning(workerPid), false)
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

test('runDevDesktop reports a preflight failure without starting watchers', async () => {
  const failure = new Error('Rust compiler is unavailable')
  const messages = []
  const errors = []
  const result = await runDevDesktop({
    checkRustToolchain: () => {
      throw failure
    },
    spawnProcess: () => assert.fail('Preflight failure must not start child processes'),
    logger: {
      log: (message) => messages.push(message),
      error: (...args) => errors.push(args),
    },
  })

  assert.equal(result, 1)
  assert.equal(errors[0][1], failure)
  assert.equal(
    messages.at(-1),
    '[dev:desktop] Finished: startup failed: Rust compiler is unavailable (exit code 1).',
  )
})

for (const scenario of [
  { name: 'normal exit', source: 'process.exit(0)', code: 0, reason: 'Tauri exited with code 0' },
  { name: 'failure', source: 'process.exit(7)', code: 7, reason: 'Tauri exited with code 7' },
  {
    name: 'signal',
    source: "process.kill(process.pid, 'SIGKILL')",
    code: 137,
    reason: 'Tauri exited on SIGKILL',
  },
  { name: 'spawn failure', source: null, code: 1, reason: 'Tauri failed to start:' },
]) {
  test(
    `runDevDesktop preserves Tauri ${scenario.name} after watcher cleanup`,
    { timeout: 10_000 },
    async (t) => {
      const lines = []
      const children = []
      let watcherReady
      const temporaryDirectory = await mkdtemp(join(tmpdir(), 'markflowy-dev-lifecycle-'))
      t.after(async () => {
        await Promise.all(children.map((child) => terminateProcessTree(child.pid)))
        await rm(temporaryDirectory, { force: true, recursive: true })
      })

      const result = await runDevDesktop({
        checkRustToolchain: () => {},
        logger: {
          log: (message) => lines.push(message),
          error: (message) => lines.push(message),
        },
        waitForArtifacts: () => watcherReady,
        spawnProcess: (_executable, _args, options) => {
          const isWatcher = children.length === 0
          const source = isWatcher
            ? `
              process.once('SIGTERM', () => {
                console.log('watcher cleanup: exited (137)')
                process.exit(137)
              })
              console.log(process.pid)
              setInterval(() => {}, 1000)
            `
            : scenario.source
          const child = spawn(process.execPath, ['-e', source ?? ''], {
            ...options,
            cwd: source === null ? join(temporaryDirectory, 'missing') : temporaryDirectory,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
          children.push(child)
          if (isWatcher) watcherReady = readPid(child.stdout)
          child.stdout.on('data', (chunk) => lines.push(chunk.toString().trim()))
          return child
        },
      })

      assert.equal(result, scenario.code)
      assert.equal(isRunning(children[0].pid), false)
      const summaryIndex = lines.findIndex((line) =>
        line.startsWith(`[dev:desktop] Finished: ${scenario.reason}`),
      )
      const cleanupIndex = lines.indexOf('[dev:desktop] Stopped dependency watchers')
      assert.ok(cleanupIndex >= 0)
      assert.ok(summaryIndex > cleanupIndex, lines.join('\n'))
      assert.match(lines[summaryIndex], new RegExp(`exit code ${scenario.code}\\)\\.$`))
      assert.equal(
        lines.some((line) => line.includes('If no development window opened')),
        scenario.code === 0,
      )
    },
  )
}

for (const stage of ['preflight', 'artifacts', 'tauri']) {
  test(
    `Ctrl+C twice during ${stage} cancels startup and releases child ports`,
    {
      timeout: 10_000,
      skip: process.platform === 'win32',
    },
    async (t) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL('./fixtures/dev-desktop-lifecycle.mjs', import.meta.url)), stage],
        { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      const observation = observeWorker(child, stage === 'artifacts' ? 'watcher' : stage)
      t.after(async () => {
        await terminateProcessTree(child.pid)
        await Promise.all(observation.workers.map((worker) => terminateProcessTree(worker.pid)))
      })
      const { ready, closed } = observation
      await ready

      child.kill('SIGINT')
      await delay(50)
      child.kill('SIGINT')
      const { code, signal, output, workers } = await closed

      assert.equal(code, 130, output)
      assert.equal(signal, null, output)
      assert.match(output, /Finished: cancelled by Ctrl\+C \(SIGINT\) \(exit code 130\)/)
      assert.equal((output.match(/\[dev:desktop\] Stopping/g) ?? []).length, 1, output)
      assert.doesNotMatch(output, /startup failed|single-instance|Force killing/)
      if (stage !== 'tauri') assert.doesNotMatch(output, /Starting Tauri/)
      if (stage === 'preflight') assert.doesNotMatch(output, /Starting dependency watchers/)
      for (const worker of workers) {
        assert.equal(isRunning(worker.pid), false, `Worker ${worker.pid} must exit`)
        await assertPortReleased(worker.port)
      }
    },
  )
}

test(
  'terminateProcessTree force-stops a worker that ignores graceful shutdown',
  {
    timeout: 10_000,
    skip: process.platform === 'win32',
  },
  async (t) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL('./fixtures/dev-desktop-lifecycle.mjs', import.meta.url)),
        'worker',
        'stubborn',
      ],
      { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    t.after(() => terminateProcessTree(child.pid, { gracePeriodMs: 100 }))
    const { ready, closed } = observeWorker(child, 'stubborn')
    const worker = await ready

    await terminateProcessTree(child.pid, { gracePeriodMs: 100 })
    const { signal } = await closed

    assert.equal(signal, 'SIGKILL')
    assert.equal(isRunning(worker.pid), false)
    await assertPortReleased(worker.port)
  },
)

test(
  'terminateProcessTree tracks children created after shutdown starts',
  {
    timeout: 10_000,
    skip: process.platform === 'win32',
  },
  async (t) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL('./fixtures/dev-desktop-lifecycle.mjs', import.meta.url)),
        'worker',
        'late-coordinator',
      ],
      { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const observation = observeWorker(child, 'late-coordinator')
    t.after(async () => {
      await terminateProcessTree(child.pid, { gracePeriodMs: 100 })
      await Promise.all(
        observation.workers.map((worker) =>
          terminateProcessTree(worker.pid, { gracePeriodMs: 100 }),
        ),
      )
    })
    await observation.ready

    await terminateProcessTree(child.pid, { gracePeriodMs: 300 })
    const { workers } = await observation.closed

    assert.equal(workers.length, 2)
    for (const worker of workers) {
      assert.equal(isRunning(worker.pid), false)
      await assertPortReleased(worker.port)
    }
  },
)
