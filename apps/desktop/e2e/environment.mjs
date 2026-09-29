import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

export const scenarios = [
  'save-reopen',
  'switch-modes',
  'external-write',
  'atomic-replace',
  'dirty-conflict',
  'switch-tabs',
  'history-restore',
  'draft-restart',
]

export function selectScenarios(requested) {
  assert.ok(requested.every((name) => scenarios.includes(name)), 'Unknown E2E scenario')
  assert.equal(new Set(requested).size, requested.length, 'Duplicate E2E scenario')
  return requested.length ? requested : scenarios
}

export async function assertBinary(binary) {
  await access(binary, constants.X_OK)
  return realpath(binary)
}

export async function createEnvironment(name, parent = tmpdir()) {
  assert.ok(scenarios.includes(name), 'Unknown E2E scenario')
  const root = await realpath(await mkdtemp(join(parent, 'markflowy-e2e-')))
  const id = randomUUID()
  await writeFile(join(root, '.markflowy-e2e'), id)
  await mkdir(join(root, 'files'))
  await mkdir(join(root, 'config'))
  return { root, id, identifier: `com.drl990114.markflowy.e2e.${id.replaceAll('-', '')}` }
}

export async function assertOwner(environment) {
  assert.match(environment.id, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
  assert.equal(environment.identifier, `com.drl990114.markflowy.e2e.${environment.id.replaceAll('-', '')}`)
  assert.equal(await readFile(join(environment.root, '.markflowy-e2e'), 'utf8'), environment.id)
  assert.equal(await realpath(environment.root), environment.root, 'E2E root was replaced')
}

// Never accept a path from the app as authority to remove arbitrary user files.
export function profilePaths(environment, home = homedir()) {
  return ['Application Support', 'Caches', 'WebKit'].map((directory) =>
    join(home, 'Library', directory, environment.identifier),
  )
}

export async function preserveEnvironment(environment, output) {
  await assertOwner(environment)
  await mkdir(output, { recursive: true })
  await cp(environment.root, join(output, 'state'), { recursive: true })
  // The allowlist is computed here, never taken from native-profile.json.
  for (const path of profilePaths(environment)) {
    await cp(path, join(output, 'profile', basename(resolve(path, '..'))), { recursive: true })
      .catch((error) => { if (error.code !== 'ENOENT') throw error })
  }
}

export async function removeEnvironment(environment) {
  await assertOwner(environment)
  for (const path of profilePaths(environment)) await rm(path, { recursive: true, force: true })
  await rm(environment.root, { recursive: true })
}

export async function availablePort() {
  const server = createServer()
  await new Promise((resolvePort, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePort)
  })
  const port = server.address().port
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()))
  return port
}
