import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNpm as runNpmCli } from './npm-cli.mjs'

const CAPRICORN_PACKAGE = '@drl990114/capricorn-runtime'
const CAPRICORN_VERSION = '0.1.17'
const CAPRICORN_SHA256 = '2e0d539f72afb22957b5410a890a5cdd384117027c58d55eba2bf234e5d8d8c4'
const GITHUB_REGISTRY = 'https://npm.pkg.github.com'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const privateRuntimeRoot = join(repositoryRoot, '.private-runtime')
const token = process.env.GITHUB_PACKAGES_TOKEN || process.env.NODE_AUTH_TOKEN

if (!token) {
  throw new Error(
    'Set GITHUB_PACKAGES_TOKEN or NODE_AUTH_TOKEN to a classic GitHub PAT with read:packages.',
  )
}

function runNpm(args) {
  return runNpmCli(args, {
    cwd: repositoryRoot,
    env: { ...process.env, NODE_AUTH_TOKEN: token },
  })
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'markflowy-capricorn-'))

try {
  const npmrcPath = join(temporaryRoot, 'npmrc')
  await writeFile(
    npmrcPath,
    [
      '@drl990114:registry=https://npm.pkg.github.com',
      '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}',
      'always-auth=true',
      '',
    ].join('\n'),
    { mode: 0o600 },
  )

  const packOutput = runNpm([
    'pack',
    `${CAPRICORN_PACKAGE}@${CAPRICORN_VERSION}`,
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    temporaryRoot,
    '--registry',
    GITHUB_REGISTRY,
    '--userconfig',
    npmrcPath,
  ])
  const packResult = JSON.parse(packOutput)
  const filename = packResult[0]?.filename
  if (typeof filename !== 'string') {
    throw new Error('GitHub Packages did not return a Capricorn tarball filename.')
  }

  const tarballPath = join(temporaryRoot, filename)
  const tarball = await readFile(tarballPath)
  const actualSha256 = createHash('sha256').update(tarball).digest('hex')
  if (actualSha256 !== CAPRICORN_SHA256) {
    throw new Error(
      `Capricorn tarball SHA-256 mismatch: expected ${CAPRICORN_SHA256}, received ${actualSha256}.`,
    )
  }

  await mkdir(privateRuntimeRoot, { recursive: true })
  runNpm([
    'install',
    '--prefix',
    privateRuntimeRoot,
    '--ignore-scripts',
    '--omit=peer',
    '--package-lock=false',
    '--no-save',
    tarballPath,
    '--userconfig',
    npmrcPath,
  ])

  const installedPackageJsonPath = join(
    privateRuntimeRoot,
    'node_modules',
    '@drl990114',
    'capricorn-runtime',
    'package.json',
  )
  const installedPackage = JSON.parse(await readFile(installedPackageJsonPath, 'utf8'))
  if (
    installedPackage.name !== CAPRICORN_PACKAGE ||
    installedPackage.version !== CAPRICORN_VERSION
  ) {
    throw new Error('The installed Capricorn package identity does not match the pinned release.')
  }

  console.log(
    `Installed ${CAPRICORN_PACKAGE}@${CAPRICORN_VERSION} with verified SHA-256 ${CAPRICORN_SHA256}.`,
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
