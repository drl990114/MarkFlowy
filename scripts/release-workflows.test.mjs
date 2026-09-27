import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import yaml from 'yaml'

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
