import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { CAPRICORN_VERSION, resolvePrivateCapricornRuntime } from '../capricornRuntimeResolver.ts'
import {
  assertBinary, assertOwner, assertSupportedPlatform, availablePort, createEnvironment, preserveEnvironment,
  removeEnvironment, selectScenarios,
} from './environment.mjs'
import { assertPhasePassed } from './results.mjs'
import { hardStopTimeout, phaseTimeout } from './timeouts.ts'

const directory = dirname(fileURLToPath(import.meta.url))
const desktop = resolve(directory, '..')
const repository = resolve(desktop, '../..')
const selected = selectScenarios(process.argv.slice(2))
assert.equal(process.platform, 'darwin', 'The first native E2E suite supports macOS 14+ only')
const { stdout: macosVersion } = await promisify(execFile)('/usr/bin/sw_vers', ['-productVersion'])
assertSupportedPlatform(process.platform, macosVersion)
assert.ok(resolvePrivateCapricornRuntime(join(repository,
  '.private-runtime/node_modules/@drl990114/capricorn-runtime/package.json')),
`Install the verified Capricorn ${CAPRICORN_VERSION} runtime before E2E; no fallback is allowed`)
const binary = await assertBinary(resolve(process.env.MARKFLOWY_E2E_BINARY ??
  join(repository, 'target/debug/markflowy')))
const output = join(directory, 'reports', new Date().toISOString().replaceAll(':', '-'))
await mkdir(output, { recursive: true })
const wdio = resolve(dirname(fileURLToPath(import.meta.resolve('@wdio/cli'))), '../bin/wdio.js')
const results = []
let interrupted = false
let activeChild
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  interrupted = true
  activeChild?.kill('SIGTERM')
})

async function stopOwnedApp(environment) {
  await assertOwner(environment)
  const metadata = await readFile(join(environment.root, 'native-profile.json'), 'utf8')
    .then(JSON.parse).catch((error) => { if (error.code !== 'ENOENT') throw error })
  if (!metadata) return
  assert.equal(metadata.identifier, environment.identifier)
  assert.ok(Number.isSafeInteger(metadata.pid) && metadata.pid > 1)
  const ownsProcess = async () => {
    const { stdout } = await promisify(execFile)('ps', ['eww', '-p', String(metadata.pid), '-o', 'command='])
      .catch(() => ({ stdout: '' }))
    return stdout.includes(binary) && stdout.includes(`MARKFLOWY_E2E_ID=${environment.id}`)
  }
  if (!(await ownsProcess())) return
  process.kill(metadata.pid, 'SIGTERM')
  for (let attempt = 0; attempt < 30; attempt++) {
    if (!(await ownsProcess())) return
    await delay(100)
  }
  if (await ownsProcess()) process.kill(metadata.pid, 'SIGKILL')
  for (let attempt = 0; attempt < 30; attempt++) {
    if (!(await ownsProcess())) return
    await delay(100)
  }
  throw new Error('Owned E2E app did not exit; keeping its profile intact')
}

async function runPhase(environment, name, phase, report) {
  const phaseOutput = join(report, phase)
  await mkdir(phaseOutput, { recursive: true })
  const port = String(await availablePort())
  const log = createWriteStream(join(phaseOutput, 'runner.log'))
  const child = spawn(process.execPath, [wdio, 'run', join(directory, 'wdio.conf.ts'),
    '--spec', join(directory, 'specs', `${name}.e2e.ts`)], {
    cwd: desktop,
    env: { ...process.env, MARKFLOWY_E2E_ROOT: environment.root, MARKFLOWY_E2E_ID: environment.id,
      MARKFLOWY_E2E_BINARY: binary, MARKFLOWY_E2E_REPORT: phaseOutput,
      MARKFLOWY_E2E_PORT: port, TAURI_WEBDRIVER_PORT: port, MARKFLOWY_E2E_PHASE: phase },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  activeChild = child
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
    process.stdout.write(chunk)
    log.write(chunk)
  })
  // Also bound launcher/service failures outside Mocha's own timeout.
  const watchdog = setTimeout(() => {
    console.error(`Native E2E phase ${name}/${phase} exceeded ${phaseTimeout}ms`)
    child.kill('SIGTERM')
  }, phaseTimeout)
  const hardStop = setTimeout(() => child.kill('SIGKILL'), hardStopTimeout)
  try {
    const code = await new Promise((resolveExit, reject) => {
      child.once('error', reject)
      child.once('exit', (code) => resolveExit(code ?? 1))
    })
    if (code === 0) await assertPhasePassed(phaseOutput)
    return code
  } finally {
    clearTimeout(watchdog)
    clearTimeout(hardStop)
    activeChild = undefined
    await new Promise((resolveLog) => log.end(resolveLog))
    await stopOwnedApp(environment)
  }
}

for (const name of selected) {
  if (interrupted) break
  const environment = await createEnvironment(name)
  const report = join(output, name)
  let failed = false
  try {
    for (const phase of name === 'draft-restart' ? ['persist', 'recover'] : ['run']) {
      const code = await runPhase(environment, name, phase, report)
      if (code !== 0) { failed = true; break }
    }
  } catch (error) {
    failed = true
    console.error(error)
  } finally {
    // Preserve receipts, real files, native profile and SQLite/WAL before cleanup.
    await stopOwnedApp(environment)
    await preserveEnvironment(environment, report)
    await removeEnvironment(environment)
  }
  results.push({ name, passed: !failed })
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2))
}
console.log(`Native E2E reports: ${output}`)
process.exitCode = interrupted || results.length !== selected.length || results.some((result) => !result.passed) ? 1 : 0
