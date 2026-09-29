import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parseReceipt } from './protocol.ts'
import {
  assertBinary, assertOwner, availablePort, createEnvironment, preserveEnvironment,
  profilePaths, removeEnvironment, scenarios, selectScenarios,
} from './environment.mjs'

test('empty selection runs all eight cases and unknown/duplicate selections fail closed', () => {
  assert.equal(scenarios.length, 8)
  assert.deepEqual(selectScenarios([]), scenarios)
  assert.deepEqual(selectScenarios(['draft-restart']), ['draft-restart'])
  assert.throws(() => selectScenarios(['external-wirte']), /Unknown/)
  assert.throws(() => selectScenarios(['save-reopen', 'save-reopen']), /Duplicate/)
})

test('the runner fails for a missing binary instead of silently skipping native tests', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'mf-e2e-contract-'))
  try {
    await assert.rejects(assertBinary(join(parent, 'not-built')), /ENOENT/)
  } finally {
    await rm(parent, { recursive: true })
  }
})

test('profiles are unique and cleanup refuses a root whose ownership marker changed', async () => {
  const first = await createEnvironment('save-reopen')
  const second = await createEnvironment('draft-restart')
  try {
    assert.notEqual(first.id, second.id)
    assert.notEqual(first.root, second.root)
    assert.notEqual(first.identifier, second.identifier)
    await assert.rejects(removeEnvironment({ ...first, identifier: 'com.drl990114.markflowy' }))
    for (const path of profilePaths(first, '/example/home')) {
      assert.ok(path.startsWith('/example/home/Library/'))
      assert.ok(path.endsWith(`/${first.identifier}`))
    }
    await writeFile(join(first.root, '.markflowy-e2e'), second.id)
    await assert.rejects(removeEnvironment(first))
    await assertOwner(second)
  } finally {
    await writeFile(join(first.root, '.markflowy-e2e'), first.id)
    await removeEnvironment(first)
    await removeEnvironment(second)
  }
})

test('diagnostics retain fixture bytes and persisted state after owned temp cleanup', async () => {
  const environment = await createEnvironment('dirty-conflict')
  const output = await mkdtemp(join(tmpdir(), 'mf-e2e-report-'))
  try {
    await writeFile(join(environment.root, 'files', 'draft.md'), 'external disk content')
    await mkdir(join(environment.root, 'local-history'))
    await writeFile(join(environment.root, 'local-history', 'history.sqlite3-wal'), 'draft WAL')
    await preserveEnvironment(environment, output)
    await removeEnvironment(environment)
    assert.equal(await readFile(join(output, 'state', 'files', 'draft.md'), 'utf8'), 'external disk content')
    assert.equal(await readFile(join(output, 'state', 'local-history', 'history.sqlite3-wal'), 'utf8'), 'draft WAL')
  } finally {
    await rm(output, { recursive: true })
  }
})

test('the embedded driver receives an available non-privileged local port', async () => {
  const port = await availablePort()
  assert.ok(Number.isInteger(port) && port > 1024 && port < 65536)
})

test('CLI receipts support native pretty JSON and preserve structured failures', () => {
  const receipt = { protocolVersion: 1, ok: true, code: 'file_status', message: '',
    result: { dirty: true, contentSha256: 'example' } }
  assert.deepEqual(parseReceipt(`native startup diagnostic\n${JSON.stringify(receipt, null, 2)}\n`), receipt)
  const failure = { ...receipt, ok: false, code: 'content_conflict' }
  assert.deepEqual(parseReceipt(JSON.stringify(failure)), failure)
  assert.throws(() => parseReceipt('native startup only'), /receipt/)
  assert.throws(() => parseReceipt('{"protocolVersion":2,"ok":true}'), /protocol/)
  assert.throws(() => parseReceipt('{"protocolVersion":1}'), /Incomplete/)
})
