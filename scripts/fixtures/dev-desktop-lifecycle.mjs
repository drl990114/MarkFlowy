import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertRustToolchainAvailable,
  runDevDesktop,
  runToolchainCommand,
  waitForRequiredArtifacts,
} from '../dev-desktop.mjs'

const [stage, role, readyPath] = process.argv.slice(2)
const fixturePath = fileURLToPath(import.meta.url)

if (stage === 'worker') {
  const server = createServer()
  let stopping = false
  const stop = () => {
    if (stopping || role === 'stubborn') return
    stopping = true
    if (role === 'late-coordinator') {
      const child = spawn(process.execPath, [fixturePath, 'worker', 'late-worker'], {
        detached: true,
        stdio: ['ignore', 'pipe', 'inherit'],
      })
      child.stdout.pipe(process.stdout)
      return
    }
    setTimeout(() => server.close(() => process.exit(0)), 150)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  server.listen(0, '127.0.0.1', () => {
    const metadata = JSON.stringify({ role, pid: process.pid, port: server.address().port })
    if (readyPath) writeFileSync(readyPath, metadata)
    else console.log(metadata)
  })
} else {
  let watcherReady
  let spawned = 0
  process.exitCode = await runDevDesktop({
    checkRustToolchain: (env, options) =>
      stage === 'preflight'
        ? assertRustToolchainAvailable(env, {
            ...options,
            runCommand: async (_command, _args, commandOptions) => {
              const directory = await mkdtemp(join(tmpdir(), 'markflowy-preflight-'))
              const metadataPath = join(directory, 'worker.json')
              try {
                const completion = runToolchainCommand(
                  process.execPath,
                  [fixturePath, 'worker', 'preflight', metadataPath],
                  commandOptions,
                )
                while (!existsSync(metadataPath) && !commandOptions.signal.aborted) {
                  await new Promise((resolve) => setTimeout(resolve, 10))
                }
                if (existsSync(metadataPath)) console.log(readFileSync(metadataPath, 'utf8'))
                return await completion
              } finally {
                await rm(directory, { recursive: true, force: true })
              }
            },
          })
        : undefined,
    spawnProcess: (_executable, _args, options) => {
      const childRole = spawned++ === 0 ? 'watcher' : 'tauri'
      const child = spawn(process.execPath, [fixturePath, 'worker', childRole], {
        ...options,
        stdio: ['ignore', 'pipe', 'inherit'],
      })
      if (childRole === 'watcher') {
        watcherReady = new Promise((resolve) => child.stdout.once('data', resolve))
      }
      child.stdout.pipe(process.stdout)
      return child
    },
    waitForArtifacts: async (isCancelled) => {
      await watcherReady
      if (stage === 'artifacts') {
        await waitForRequiredArtifacts(isCancelled, {
          artifacts: [fileURLToPath(new URL('./does-not-exist', import.meta.url))],
          pollIntervalMs: 10,
        })
      }
    },
  })
}
