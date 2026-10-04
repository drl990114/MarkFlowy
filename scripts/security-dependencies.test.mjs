import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import yaml from 'yaml'

const rootRequire = createRequire(new URL('../package.json', import.meta.url))
const editorRequire = createRequire(new URL('../packages/editor/package.json', import.meta.url))
const execFileAsync = promisify(execFile)

test('postinstall patches target locked dependencies and apply with CI failure handling', async (t) => {
  const lockfile = yaml.parse(await readFile(new URL('../yarn.lock', import.meta.url), 'utf8'))
  const lockedPackages = new Map(
    Object.values(lockfile).flatMap(({ resolution }) => {
      if (!resolution?.includes('@npm:')) return []
      const [name, version] = resolution.split('@npm:')
      return [[`${name.replaceAll('/', '+')}+${version}.patch`, name]]
    }),
  )
  const patches = new URL('../patches/', import.meta.url)
  const fixture = await mkdtemp(join(tmpdir(), 'markflowy-postinstall-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ private: true }))
  await cp(patches, join(fixture, 'patches'), { recursive: true })

  for (const patch of (await readdir(patches)).filter((name) => name.endsWith('.patch'))) {
    const name = lockedPackages.get(patch)
    assert.ok(name, `${patch} targets a package/version absent from yarn.lock`)
    await cp(
      new URL(`../node_modules/${name}/`, import.meta.url),
      join(fixture, 'node_modules', name),
      {
        recursive: true,
      },
    )
  }

  await execFileAsync(
    process.execPath,
    [rootRequire.resolve('patch-package/index.js'), '--error-on-fail', '--error-on-warn'],
    { cwd: fixture, env: { ...process.env, CI: 'true' }, timeout: 10_000 },
  )
})

test('TOML frontmatter retains MDX exports after the parser upgrade', async () => {
  const { compile } = await import('@mdx-js/mdx')
  const { default: frontmatter } = await import('remark-frontmatter')
  const { default: mdxFrontmatter } = await import('remark-mdx-frontmatter')
  const result = await compile('+++\ntitle = "MarkFlowy"\ncount = 2\n+++\n\n# Hello', {
    remarkPlugins: [[frontmatter, ['toml']], mdxFrontmatter],
  })
  assert.match(String(result), /export const frontmatter/)
  assert.match(String(result), /"title": "MarkFlowy"/)
  assert.match(String(result), /"count": 2/)
})

test('the frontmatter parser limits nesting and isolates prototype keys', () => {
  const remarkRequire = createRequire(rootRequire.resolve('remark-mdx-frontmatter'))
  const toml = remarkRequire('toml')
  assert.throws(() => toml.parse(`value = ${'['.repeat(501)}0${']'.repeat(501)}`), /depth|nest/i)
  const result = toml.parse('[__proto__]\npolluted = true\n[__proto__.nested]\nvalue = "data"')
  assert.equal(Object.getPrototypeOf(result), null)
  assert.equal(Object.hasOwn(result, '__proto__'), true)
  assert.equal(result.__proto__.nested.value, 'data')
  assert.equal({}.polluted, undefined)
})

for (const consumer of ['mdx-bundler']) {
  test(`${consumer} can still require UUID and generate v4 identifiers`, () => {
    const consumerRequire = createRequire(rootRequire.resolve(consumer))
    const uuid = consumerRequire('uuid')
    const value = uuid.v4()
    assert.equal(uuid.validate(value), true)
    assert.equal(uuid.version(value), 4)
  })
}

for (const fixture of ['default', 'math', 'readme']) {
  test(`the native text loader preserves the ${fixture} Markdown fixture`, async () => {
    const markdown = await readFile(
      new URL(`../packages/editor/src/playground/test-md/${fixture}.md`, import.meta.url),
      'utf8',
    )
    const { code } = await editorRequire('esbuild').transform(markdown, {
      loader: 'text',
      format: 'esm',
    })
    const result = await import(
      `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
    )
    assert.equal(result.default, markdown)
  })
}

test('Contentlayer tracing retains the SDK contract with the fixed Jaeger propagator', async () => {
  const contentlayerRequire = createRequire(import.meta.resolve('@contentlayer2/utils'))
  const providerEntry = contentlayerRequire.resolve('@opentelemetry/sdk-trace-node')
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '-e',
      `
    const assert = require('node:assert/strict')
    const { createRequire } = require('node:module')
    const providerRequire = createRequire(process.argv[1])
    const { NodeTracerProvider } = require(process.argv[1])
    const api = providerRequire('@opentelemetry/api')
    const { suppressTracing } = providerRequire('@opentelemetry/core')
    const propagator = new (providerRequire('@opentelemetry/propagator-jaeger').JaegerPropagator)()
    const provider = new NodeTracerProvider()
    provider.register({ contextManager: null })
    const carrier = {
      'uber-trace-id': '1234567890abcdef1234567890abcdef:1234567890abcdef:0:1',
      'uberctx-user': 'Alice%20Wang',
    }
    const context = api.propagation.extract(api.ROOT_CONTEXT, carrier)
    assert.equal(api.trace.getSpanContext(context).traceId, '1234567890abcdef1234567890abcdef')
    assert.equal(api.propagation.getBaggage(context).getEntry('user').value, 'Alice Wang')
    const outgoing = {}
    api.propagation.inject(context, outgoing)
    assert.equal(outgoing['uber-trace-id'], '1234567890abcdef1234567890abcdef:1234567890abcdef:0:01')
    assert.deepEqual(api.trace.getSpanContext(api.propagation.extract(api.ROOT_CONTEXT, outgoing)), api.trace.getSpanContext(context))
    assert.equal(outgoing['uberctx-user'], carrier['uberctx-user'])
    for (const bad of [
      { 'uber-trace-id': '%' },
      { ...carrier, 'uberctx-user': '%' },
      { ...carrier, 'uberctx-user': '%E0%A4%A' },
    ]) {
      assert.doesNotThrow(() => propagator.extract(api.ROOT_CONTEXT, bad, api.defaultTextMapGetter))
      assert.doesNotThrow(() => api.propagation.extract(api.ROOT_CONTEXT, bad))
    }
    const suppressed = {}
    api.propagation.inject(suppressTracing(context), suppressed)
    assert.equal(suppressed['uber-trace-id'], undefined)
    assert.equal(suppressed['uberctx-user'], carrier['uberctx-user'])
    const span = provider.getTracer('contentlayer-compatibility').startSpan('document', {}, context)
    assert.equal(span.spanContext().traceId, api.trace.getSpanContext(context).traceId)
    span.end()
    provider.shutdown().then(() => process.stdout.write('compatible'))
  `,
      providerEntry,
    ],
    {
      timeout: 10_000,
      env: { ...process.env, OTEL_PROPAGATORS: 'jaeger', OTEL_TRACES_EXPORTER: 'none' },
    },
  )
  assert.equal(stdout, 'compatible')
})
