import assert from 'node:assert/strict'
import test from 'node:test'
import { createConfig } from '../../../rollup.config.mjs'
import configs from '../rollup.config.mjs'

const emptyBundleWarning = {
  code: 'EMPTY_BUNDLE',
  message: 'Generated an empty chunk: "index".',
  names: ['index'],
}

for (const config of configs) {
  const format = config.output.format

  test(`${format}: the retired runtime API permits its empty compatibility entry`, () => {
    assert.doesNotThrow(() => config.onwarn(emptyBundleWarning))
  })

  test(`${format}: unexpected warnings still fail the runtime API build`, () => {
    for (const warning of [
      { code: 'UNRESOLVED_IMPORT', message: 'Could not resolve dependency.' },
      { code: 'PLUGIN_WARNING', plugin: 'typescript', message: 'Type error.' },
    ]) {
      assert.throws(() => config.onwarn(warning), warning)
    }
  })
}

test('other workspaces still reject accidental empty bundles', () => {
  const strictConfigs = createConfig({
    pkg: { module: 'dist/index.mjs', browser: 'dist/index.js' },
  })
  for (const config of strictConfigs) {
    assert.throws(() => config.onwarn(emptyBundleWarning), emptyBundleWarning)
  }
})
