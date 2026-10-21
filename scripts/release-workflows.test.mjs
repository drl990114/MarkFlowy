import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import glob from 'fast-glob'
import yaml from 'yaml'

const execFileAsync = promisify(execFile)
const workflow = async (name) =>
  yaml.parse(await readFile(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'))
const release = await workflow('tauri-release')
const quality = await workflow('test-ci')

function prerequisites(jobs, id, visiting = new Set()) {
  assert.ok(jobs[id], `Unknown prerequisite job: ${id}`)
  assert.ok(!visiting.has(id), `Circular job dependency: ${id}`)
  const seen = new Set([...visiting, id])
  const direct = [jobs[id].needs ?? []].flat()
  return new Set(
    direct.flatMap((dependency) => [dependency, ...prerequisites(jobs, dependency, seen)]),
  )
}

test('every release build and publication depends on the shared quality gate', () => {
  assert.equal(release.jobs.quality.uses, './.github/workflows/test-ci.yml')
  assert.ok(release.jobs.quality.secrets.CAPRICORN_READ_TOKEN)
  for (const id of ['build', 'build-offline-installer', 'release']) {
    assert.ok(prerequisites(release.jobs, id).has('quality'), `${id} bypasses quality checks`)
    assert.notEqual(release.jobs[id]['continue-on-error'], true, id)
    assert.doesNotMatch(release.jobs[id].if ?? '', /always\(\)/, id)
  }
})

test('the shared gate requires real runtime, type, Rust and content validation', () => {
  assert.equal(quality.on.workflow_call.secrets.CAPRICORN_READ_TOKEN.required, true)
  assert.equal(quality.permissions.contents, 'read')
  const steps = quality.jobs.test.steps
  const commands = steps.filter((step) => step.run).flatMap((step) => step.run.split('\n'))
  for (const command of [
    'yarn install:capricorn-runtime',
    'yarn workspace @markflowy/desktop build:types',
    'yarn workspace @markflowy/desktop test:e2e:types',
    'yarn workspace @markflowy/desktop test:e2e:runner',
    'yarn workspace @markflowy/desktop tauri:build:e2e',
    'yarn workspace @markflowy/desktop test:e2e',
    'yarn workspace @markflowy/web build:types',
    'yarn test',
    'yarn workspace @markflowy/desktop test:capricorn-published',
    'cargo test --workspace --lib --tests --locked',
    'yarn workspace @markflowy/web test:content',
    'yarn test:security-dependencies',
    'yarn test:release-workflows',
    'yarn test:dev-desktop',
    'yarn translate:check',
  ]) {
    assert.ok(commands.includes(command), `Missing release gate: ${command}`)
  }
  for (const step of steps) assert.notEqual(step['continue-on-error'], true, step.name)
  const generation = steps.findIndex((step) => step.run === 'yarn build')
  const verification = steps.findIndex(
    (step) => step.run === 'yarn workspace @markflowy/web test:content',
  )
  assert.ok(generation >= 0 && verification > generation)
})

test('native E2E is a required macOS gate and always retains diagnostics', () => {
  assert.equal(quality.jobs.test['runs-on'], 'macos-latest')
  const steps = quality.jobs.test.steps
  const frontend = steps.findIndex((step) => step.run === 'yarn build')
  const native = steps.findIndex(
    (step) => step.run === 'yarn workspace @markflowy/desktop tauri:build:e2e',
  )
  const execution = steps.findIndex(
    (step) => step.run === 'yarn workspace @markflowy/desktop test:e2e',
  )
  assert.ok(frontend >= 0 && native > frontend && execution > native)
  for (const step of [steps[native], steps[execution]]) {
    assert.equal(step.if, undefined, 'Native E2E must not be optional on a passing CI run')
    assert.equal(step['continue-on-error'], undefined)
  }
  assert.equal(steps[execution]['timeout-minutes'], 20)
  const artifact = steps.find((step) => step.uses === 'actions/upload-artifact@v4')
  assert.equal(artifact.if, 'always()')
  assert.equal(artifact.with.path, 'apps/desktop/e2e/reports/')
  assert.equal(artifact.with['retention-days'], 7)
  assert.ok(steps.indexOf(artifact) > execution)
})

test('all release packages retain matching signatures through collection and publication', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'markflowy-release-artifacts-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const version = '1.2.3'
  const withSignatures = (assets) =>
    assets.flatMap(([source, destination]) => [
      [source, destination],
      [`${source}.sig`, `${destination}.sig`],
    ])
  const cases = [
    {
      build: 'linux',
      arch: 'x86_64',
      job: 'build',
      uploadIf: "matrix.os == 'ubuntu-22.04'",
      download: 'Download x86_64 artifacts',
      fixtures: withSignatures([
        ['deb/MarkFlowy_1.2.3_amd64.deb', 'MarkFlowy_v1.2.3_amd64.deb'],
        ['rpm/MarkFlowy-1.2.3-1.x86_64.rpm', 'MarkFlowy-1.2.3-1.x86_64.rpm'],
        ['appimage/MarkFlowy_1.2.3_amd64.AppImage', 'MarkFlowy_v1.2.3_amd64.AppImage'],
      ]),
    },
    ...[
      ['x86_64', 'x64', 'Download x86_64 artifacts'],
      ['aarch64', 'aarch64', 'Download aarch64 artifacts'],
    ].map(([arch, filenameArch, download]) => ({
      build: 'macos',
      arch,
      job: 'build',
      uploadIf: `matrix.os == 'macos-latest' && matrix.arch == '${arch}'`,
      download,
      fixtures: [
        [`dmg/MarkFlowy_1.2.3_${filenameArch}.dmg`, `MarkFlowy_v1.2.3_${filenameArch}.dmg`],
        ...withSignatures([['macos/MarkFlowy.app.tar.gz', `MarkFlowy_${filenameArch}.app.tar.gz`]]),
      ],
    })),
    {
      build: 'windows',
      arch: 'x86_64',
      job: 'build',
      uploadIf: "matrix.os == 'windows-latest'",
      download: 'Download x86_64 artifacts',
      fixtures: [
        ...withSignatures([
          ['msi/MarkFlowy_1.2.3_x64_en-US.msi', 'MarkFlowy_v1.2.3_x64.msi'],
          ['nsis/MarkFlowy_1.2.3_x64-setup.exe', 'MarkFlowy_v1.2.3_x64-setup.exe'],
        ]),
        ['portable/MarkFlowy_1.2.3_x64_portable.zip', 'MarkFlowy_v1.2.3_x64_portable.zip'],
      ],
    },
    {
      build: 'windows-offline-installer',
      arch: 'x86_64',
      job: 'build-offline-installer',
      uploadIf: "matrix.os == 'windows-latest'",
      download: 'Download offline installer artifacts',
      fixtures: withSignatures([
        ['msi/MarkFlowy_1.2.3_x64_en-US.msi', 'MarkFlowy_v1.2.3_offline_installer_x64.msi'],
        ['nsis/MarkFlowy_1.2.3_x64-setup.exe', 'MarkFlowy_v1.2.3_offline_installer_x64-setup.exe'],
      ]),
    },
  ]

  const steps = release.jobs.release.steps
  for (const scenario of cases) {
    const label = `${scenario.build}-${scenario.arch}`
    const buildDirectory = path.join(directory, label)
    const job = release.jobs[scenario.job]
    const matrix = job.strategy.matrix.include.find(
      (entry) => entry.build === scenario.build && entry.arch === scenario.arch,
    )
    assert.ok(matrix, `Missing build matrix entry: ${label}`)
    const bundle = `target/${matrix.target}/release/bundle`
    for (const [source] of scenario.fixtures) {
      const filename = path.join(buildDirectory, bundle, source)
      await mkdir(path.dirname(filename), { recursive: true })
      await writeFile(filename, `fixture:${label}:${source}`)
    }

    const upload = job.steps.find(
      (step) => step.uses === 'actions/upload-artifact@v4' && step.if === scenario.uploadIf,
    )
    assert.ok(upload, `Missing artifact upload: ${label}`)
    const patterns = upload.with.path
      .trim()
      .split('\n')
      .map((pattern) => pattern.replaceAll('${{ matrix.target }}', matrix.target))
    const collected = await glob(patterns, { cwd: buildDirectory })
    assert.deepEqual(
      collected.map((filename) => path.relative(bundle, filename)).sort(),
      scenario.fixtures.map(([source]) => source).sort(),
      `${label} upload must include every package and its updater signature`,
    )

    const download = steps.find((step) => step.name === scenario.download)
    const artifactName = upload.with.name.replaceAll('${{ matrix.target }}', matrix.target)
    assert.ok(path.matchesGlob(artifactName, download.with.pattern), `${label} is not downloaded`)
    for (const filename of collected) {
      const destination = path.join(directory, download.with.path, path.relative(bundle, filename))
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(path.join(buildDirectory, filename), destination)
    }
  }
  const rename = steps
    .find((step) => step.name === 'Rename artifacts')
    .run.replaceAll('${{ env.version }}', version)
  await execFileAsync('bash', ['-e', '-c', rename], { cwd: directory })

  const publication = steps.find((step) => step.name === 'Create Release')
  const published = await glob(publication.with.files, { cwd: directory })
  assert.deepEqual(
    published.map((filename) => path.relative('artifacts', filename)).sort(),
    cases.flatMap(({ fixtures }) => fixtures.map(([, destination]) => destination)).sort(),
    'Release assets must preserve adjacent package/signature names after renaming',
  )
  for (const { build, arch, fixtures } of cases) {
    for (const [source, destination] of fixtures) {
      assert.equal(
        await readFile(path.join(directory, 'artifacts', destination), 'utf8'),
        `fixture:${build}-${arch}:${source}`,
        `Published bytes changed for ${destination}`,
      )
    }
  }
})
