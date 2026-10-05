import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const require = createRequire(new URL('../packages/zens/package.json', import.meta.url))
const postcss = require('postcss')
const tailwind = require('@tailwindcss/postcss')
const stylesheet = new URL('../packages/zens/src/styles.css', import.meta.url)

test('the earliest Desktop stylesheet reserves host utilities above shared component defaults', async () => {
  const layers = []
  // A later @layer statement cannot reorder names already registered by normalize.css.
  for (const path of ['../apps/desktop/src/normalize.css', '../packages/zens/src/styles.css', '../apps/desktop/src/ui.css']) {
    const root = postcss.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
    for (const node of root.nodes) {
      if (node.type !== 'atrule' || node.name !== 'layer') continue
      for (const name of node.params.split(',').map((value) => value.trim())) {
        if (!layers.includes(name)) layers.push(name)
      }
    }
  }
  assert.ok(layers.indexOf('components') < layers.indexOf('mf-components'))
  assert.ok(layers.indexOf('mf-components') < layers.indexOf('utilities'))
})

test('shared CSS provides real prefixed utilities without a host Tailwind scan or preflight', async () => {
  // Exercise the actual PostCSS contract entirely in memory; no package/app build.
  const result = await postcss([tailwind({ optimize: false })]).process(
    await readFile(stylesheet, 'utf8'),
    { from: fileURLToPath(stylesheet) },
  )
  const selectors = new Set()
  result.root.walkRules((rule) => selectors.add(rule.selector))
  assert.ok(selectors.has('.mfc\\:inline-flex'))
  assert.ok(selectors.has('.mfc\\:bg-primary'))
  assert.ok(selectors.has('.mfc\\:text-ui-control'))
  assert.ok(!selectors.has('.inline-flex'))
  assert.ok(!selectors.has('button, input, optgroup, select, textarea, ::file-selector-button'))
  assert.ok(!selectors.has('html, :host'))
  assert.match(result.css, /@layer theme, base, components, mf-components, utilities/)

  let primaryRule
  result.root.walkRules('.mfc\\:bg-primary', (rule) => { primaryRule = rule })
  assert.equal(primaryRule?.parent.name, 'layer')
  assert.equal(primaryRule?.parent.params, 'mf-components')
  assert.match(primaryRule.toString(), /var\(--mf-primary,/)
  assert.doesNotMatch(result.css, /--mf-boot-/)
  assert.doesNotMatch(result.css, /@tailwind|@source|@theme/)
})
