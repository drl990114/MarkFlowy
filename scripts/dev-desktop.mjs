import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DESKTOP_DIR = resolve(ROOT_DIR, 'apps/desktop')
const GRACE_PERIOD_MS = 2_000
const FORCE_KILL_WAIT_MS = 500
const ARTIFACT_WAIT_TIMEOUT_MS = 120_000
const ARTIFACT_STABILITY_MS = 1_000
const ARTIFACT_POLL_INTERVAL_MS = 100
const isWindows = process.platform === 'win32'

const requiredArtifacts = [
  'packages/api-client/dist/index.mjs',
  'packages/editor/dist/index.mjs',
  'packages/github-api/dist/index.mjs',
  'packages/interface/dist/index.mjs',
  'packages/theme/dist/index.mjs',
  'packages/zens/esm/index.js',
  'packages/zens/esm/Box/index.js',
  'packages/zens/esm/Dialog/styles.js',
  'packages/zens/esm/Dropdown/styles.js',
  'packages/zens/esm/Popover/styles.js',
  'packages/zens/esm/Shortcut/styles.js',
].map((path) => resolve(ROOT_DIR, path))

const require = createRequire(import.meta.url)
const turboCli = require.resolve('turbo/bin/turbo')
const tauriCli = require.resolve('@tauri-apps/cli/tauri.js')

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

export const withCargoOnPath = (
  env = process.env,
  {
    homeDirectory = homedir(),
    pathDelimiter = delimiter,
    pathExists = existsSync,
    platform = process.platform,
  } = {},
) => {
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
  const currentPath = env[pathKey] ?? ''
  const cargoExecutable = platform === 'win32' ? 'cargo.exe' : 'cargo'
  const rustcExecutable = platform === 'win32' ? 'rustc.exe' : 'rustc'
  const pathEntries = currentPath.split(pathDelimiter).filter(Boolean)

  if (
    pathEntries.some(
      (entry) =>
        pathExists(join(entry, cargoExecutable)) && pathExists(join(entry, rustcExecutable)),
    )
  ) {
    return { ...env }
  }

  const cargoHome = env.CARGO_HOME || join(homeDirectory, '.cargo')
  const cargoBin = join(cargoHome, 'bin')
  if (
    !pathExists(join(cargoBin, cargoExecutable)) ||
    !pathExists(join(cargoBin, rustcExecutable))
  ) {
    return { ...env }
  }

  return {
    ...env,
    [pathKey]: [cargoBin, currentPath].filter(Boolean).join(pathDelimiter),
  }
}

export const assertRustToolchainAvailable = (
  env,
  { runCommand = spawnSync, platform = process.platform } = {},
) => {
  const executableSuffix = platform === 'win32' ? '.exe' : ''
  const checks = [
    { command: `cargo${executableSuffix}`, args: ['--version'], label: 'Cargo' },
    { command: `rustc${executableSuffix}`, args: ['-vV'], label: 'Rust compiler' },
  ]

  for (const { command, args, label } of checks) {
    const result = runCommand(command, args, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      windowsHide: true,
    })
    const hasRustHost = command.startsWith('rustc')
      ? result.stdout?.split('\n').some((line) => line.startsWith('host:'))
      : true

    if (result.status === 0 && hasRustHost) continue

    const details = result.stderr?.trim() || result.error?.message
    throw new Error(
      `${label} is unavailable or incomplete. Reinstall the Rust version declared in ` +
        '`rust-toolchain.toml` with rustup, or fix PATH' +
        `${details ? `: ${details}` : '.'}`,
    )
  }
}

const isProcessRunning = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

const listProcessTree = (rootPid) => {
  if (isWindows) return [rootPid]

  const result = spawnSync('ps', ['-A', '-o', 'ppid=,pid='], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  if (result.status !== 0 || !result.stdout) return [rootPid]

  const childrenByParent = new Map()

  for (const line of result.stdout.split('\n')) {
    const [parentValue, pidValue] = line.trim().split(/\s+/)
    const parentPid = Number(parentValue)
    const pid = Number(pidValue)

    if (!Number.isInteger(parentPid) || !Number.isInteger(pid)) continue

    const children = childrenByParent.get(parentPid) ?? []
    children.push(pid)
    childrenByParent.set(parentPid, children)
  }

  const processTree = [rootPid]

  for (let index = 0; index < processTree.length; index += 1) {
    const children = childrenByParent.get(processTree[index]) ?? []
    processTree.push(...children)
  }

  return processTree
}

const signalProcess = (pid, signal) => {
  try {
    process.kill(pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
}

const waitForProcessesToExit = async (pids, timeoutMs) => {
  const deadline = Date.now() + timeoutMs
  let remaining = pids.filter(isProcessRunning)

  while (remaining.length > 0 && Date.now() < deadline) {
    await delay(50)
    remaining = remaining.filter(isProcessRunning)
  }

  return remaining
}

export const waitForRequiredArtifacts = async (
  isCancelled,
  {
    artifacts = requiredArtifacts,
    pollIntervalMs = ARTIFACT_POLL_INTERVAL_MS,
    stabilityMs = ARTIFACT_STABILITY_MS,
    timeoutMs = ARTIFACT_WAIT_TIMEOUT_MS,
  } = {},
) => {
  const deadline = Date.now() + timeoutMs
  let readySince = null
  let missingArtifacts = artifacts.filter((path) => !existsSync(path))

  while (Date.now() < deadline && !isCancelled()) {
    missingArtifacts = artifacts.filter((path) => !existsSync(path))

    if (missingArtifacts.length === 0) {
      readySince ??= Date.now()
      if (Date.now() - readySince >= stabilityMs) return
    } else {
      readySince = null
    }

    await delay(pollIntervalMs)
  }

  if (isCancelled()) return

  if (missingArtifacts.length === 0) {
    throw new Error('Timed out waiting for Desktop dependency artifacts to stabilize')
  }

  const relativePaths = missingArtifacts.map((path) => path.slice(ROOT_DIR.length + 1))
  throw new Error(`Timed out waiting for Desktop dependencies: ${relativePaths.join(', ')}`)
}

export const terminateProcessTree = async (
  rootPid,
  { forceKillWaitMs = FORCE_KILL_WAIT_MS, gracePeriodMs = GRACE_PERIOD_MS } = {},
) => {
  if (!Number.isInteger(rootPid) || rootPid <= 0 || rootPid === process.pid) return

  if (isWindows) {
    spawnSync('taskkill', ['/PID', String(rootPid), '/T'], {
      stdio: 'ignore',
      windowsHide: true,
    })

    const remaining = await waitForProcessesToExit([rootPid], gracePeriodMs)
    if (remaining.length === 0) return

    spawnSync('taskkill', ['/F', '/PID', String(rootPid), '/T'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    await waitForProcessesToExit(remaining, forceKillWaitMs)
    return
  }

  // Turbo starts each persistent task in its own process group. Snapshot the
  // full descendant tree before signaling the root so re-parenting cannot
  // leave TypeScript/esbuild watchers behind.
  const processTree = listProcessTree(rootPid)
  const descendants = processTree.slice(1).reverse()

  signalProcess(rootPid, 'SIGTERM')
  for (const pid of descendants) signalProcess(pid, 'SIGTERM')

  const remaining = await waitForProcessesToExit(processTree, gracePeriodMs)
  for (const pid of remaining.reverse()) signalProcess(pid, 'SIGKILL')
  await waitForProcessesToExit(remaining, forceKillWaitMs)
}

const exitCodeFor = (code, signal) => {
  if (typeof code === 'number') return code
  if (signal === 'SIGINT') return 130
  if (signal === 'SIGHUP') return 129
  if (signal === 'SIGTERM') return 143
  return 1
}

export const runDevDesktop = async () => {
  const devEnvironment = withCargoOnPath()
  const children = new Map()
  let shuttingDown = false
  let resolveShutdownStarted
  let shutdownPromise

  const shutdownStarted = new Promise((resolveStarted) => {
    resolveShutdownStarted = resolveStarted
  })

  const spawnManaged = (label, cli, args, cwd) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      detached: !isWindows,
      env: devEnvironment,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    })

    if (child.pid) children.set(child.pid, { label })
    child.once('exit', () => {
      if (child.pid) children.delete(child.pid)
    })

    return child
  }

  const requestShutdown = (exitCode, reason) => {
    if (shutdownPromise) return shutdownPromise

    shuttingDown = true
    resolveShutdownStarted()
    console.log(`\n[dev:desktop] Stopping (${reason})...`)

    const activeChildren = [...children.entries()]
    shutdownPromise = Promise.allSettled(
      activeChildren.map(async ([pid, { label }]) => {
        await terminateProcessTree(pid)
        console.log(`[dev:desktop] Stopped ${label}`)
      }),
    ).then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const label = activeChildren[index][1].label
          console.error(`[dev:desktop] Failed to stop ${label}:`, result.reason)
        }
      })
      return exitCode
    })

    return shutdownPromise
  }

  const signalHandlers = new Map([
    ['SIGINT', () => void requestShutdown(130, 'SIGINT')],
    ['SIGTERM', () => void requestShutdown(143, 'SIGTERM')],
  ])

  if (!isWindows) {
    signalHandlers.set('SIGHUP', () => void requestShutdown(129, 'SIGHUP'))
  }

  for (const [signal, handler] of signalHandlers) process.on(signal, handler)

  try {
    assertRustToolchainAvailable(devEnvironment)
    console.log('[dev:desktop] Starting dependency watchers...')
    const turboProcess = spawnManaged(
      'dependency watchers',
      turboCli,
      [
        'run',
        'dev',
        '--filter=@markflowy/desktop^...',
        '--filter=!zens',
        '--no-update-notifier',
        '--output-logs=new-only',
        '--ui=stream',
      ],
      ROOT_DIR,
    )

    turboProcess.once('error', (error) => {
      console.error(`[dev:desktop] Failed to start dependency watchers: ${error.message}`)
    })
    turboProcess.once('exit', (code, signal) => {
      if (!shuttingDown) {
        void requestShutdown(exitCodeFor(code, signal), 'dependency watchers exited')
      }
    })

    await waitForRequiredArtifacts(() => shuttingDown)
    if (shuttingDown) return await shutdownPromise

    console.log('[dev:desktop] Starting Tauri...')
    const tauriProcess = spawnManaged('Tauri', tauriCli, ['dev'], DESKTOP_DIR)

    tauriProcess.once('error', (error) => {
      console.error(`[dev:desktop] Failed to start Tauri: ${error.message}`)
    })
    tauriProcess.once('exit', (code, signal) => {
      if (!shuttingDown) void requestShutdown(exitCodeFor(code, signal), 'Tauri exited')
    })

    await shutdownStarted
    return await shutdownPromise
  } catch (error) {
    console.error('[dev:desktop] Unexpected failure:', error)
    return await requestShutdown(1, 'unexpected failure')
  } finally {
    for (const [signal, handler] of signalHandlers) process.off(signal, handler)
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  process.exitCode = await runDevDesktop()
}
