import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { resolveNpmCli, runNpm } from './npm-cli.mjs'

for (const [platform, execPath, npmCli] of [
  [
    'win32',
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
  ],
  ['linux', '/opt/node/bin/node', '/opt/node/lib/node_modules/npm/bin/npm-cli.js'],
  ['darwin', '/opt/homebrew/bin/node', '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js'],
]) {
  test(`resolves the npm JS entry on ${platform}, including when launched by Yarn`, () => {
    assert.equal(
      resolveNpmCli({
        platform,
        execPath,
        env: { npm_execpath: '/repo/.yarn/yarn.cjs' },
        pathExists: (value) => value === npmCli,
      }),
      npmCli,
    )
  })
}

test('finds a separate Windows npm installation through case-insensitive Path', () => {
  const npmCli =
    'C:\\Users\\Example User\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js'
  assert.equal(
    resolveNpmCli({
      platform: 'win32',
      execPath: 'C:\\node\\node.exe',
      env: { Path: 'C:\\tools;C:\\Users\\Example User\\AppData\\Roaming\\npm' },
      pathExists: (value) => value === npmCli,
    }),
    npmCli,
  )
})

test('resolves Unix package-manager symlinks', () => {
  assert.equal(
    resolveNpmCli({
      platform: 'linux',
      execPath: '/usr/bin/node',
      env: { PATH: '/usr/bin' },
      pathExists: (value) =>
        ['/usr/bin/npm', '/usr/share/nodejs/npm/bin/npm-cli.js'].includes(value),
      realPath: () => '/usr/share/nodejs/npm/bin/npm-cli.js',
    }),
    '/usr/share/nodejs/npm/bin/npm-cli.js',
  )
})

test('runs the JS CLI preserving spaces and shell metacharacters in paths and arguments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'markflowy npm & '))
  try {
    const cli = join(directory, 'npm-cli.js')
    await writeFile(cli, 'console.log(JSON.stringify(process.argv.slice(2)))')
    const args = [
      'pack',
      '@scope/package@1.0.0',
      '--pack-destination',
      'C:\\Users\\A & B\\(notes)',
      '$(echo nope)',
      '%PATH%',
    ]
    assert.deepEqual(JSON.parse(runNpm(args, { env: { ...process.env, npm_execpath: cli } })), args)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
