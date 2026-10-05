import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function assertPhasePassed(directory) {
  // WDIO can exit 0 before starting Mocha when an existing spec contains no tests.
  // Each scenario/phase must produce its one completed-test record as well as exit 0.
  const reports = (await readdir(directory)).filter((name) => name.endsWith('.result.json'))
  assert.equal(reports.length, 1, 'E2E phase did not execute exactly one test')
  const result = JSON.parse(await readFile(join(directory, reports[0]), 'utf8'))
  assert.equal(result.passed, true, 'E2E phase did not record a passing test')
}
