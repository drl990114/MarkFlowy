import assert from 'node:assert/strict'

export interface Receipt<T> {
  protocolVersion: 1
  ok: boolean
  code: string
  message: string
  result: T
}

export function parseReceipt<T>(stdout: string): Receipt<T> {
  // Native print_json uses pretty JSON, preceded by optional startup diagnostics.
  const lines = stdout.trim().split('\n')
  const start = lines.findLastIndex((line) => line.startsWith('{'))
  assert.ok(start >= 0, 'CLI did not return a JSON receipt')
  const receipt = JSON.parse(lines.slice(start).join('\n')) as Receipt<T>
  assert.equal(receipt.protocolVersion, 1, 'Unexpected CLI protocol')
  assert.equal(typeof receipt.ok, 'boolean', 'Incomplete CLI receipt')
  assert.equal(typeof receipt.code, 'string', 'Incomplete CLI receipt')
  return receipt
}
