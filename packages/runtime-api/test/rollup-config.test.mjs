import assert from 'node:assert/strict'
import test from 'node:test'
import { createConfig } from '../../../rollup.config.mjs'
import interfaceConfigs from '../../interface/rollup.config.mjs'
import configs from '../rollup.config.mjs'

function isExternal(config, id) {
  return typeof config.external === 'function'
    ? config.external(id, undefined, false)
    : config.external.includes(id)
}

for (const config of interfaceConfigs) {
  const format = config.output.format

  test(`${format}: interface dependencies include JSX runtimes and package subpaths`, () => {
    for (const id of [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom/client',
      'zens/esm/components/button',
      '@markflowy/i18n',
      '@markflowy/i18n/locales/en',
      '@codemirror/view',
      '@codemirror/view/subpath',
    ]) {
      assert.equal(isExternal(config, id), true, id)
    }
  })

  test(`${format}: local modules and similarly named packages stay internal`, () => {
    for (const id of [
      './components/Empty',
      '../react/jsx-runtime',
      '/workspace/src/react/jsx-runtime',
      'react-extra',
      'react-dom-extra/client',
      'zens-extra/esm/components/button',
      '@markflowy/i18n-extra/locales/en',
      '@markflowy/unknown',
    ]) {
      assert.equal(isExternal(config, id), false, id)
    }
  })
}

test('builtins, explicit externals, and CJS compatibility externals retain their behavior', () => {
  const customConfigs = createConfig({
    pkg: { module: 'dist/index.mjs', browser: 'dist/index.js' },
    external: ['custom-package/entry'],
  })
  for (const config of customConfigs) {
    for (const id of ['fs', 'fs/promises', 'custom-package/entry']) {
      assert.equal(isExternal(config, id), true, id)
    }
    for (const id of ['custom-package', 'custom-package/other', 'custom-package/entry/child']) {
      assert.equal(isExternal(config, id), false, id)
    }
    for (const id of ['styled-components', 'color']) {
      assert.equal(isExternal(config, id), config.output.format === 'cjs', id)
    }
  }
})

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
