import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const rootRequire = createRequire(new URL('../package.json', import.meta.url))
const zensRequire = createRequire(new URL('../packages/zens/package.json', import.meta.url))
const editorRequire = createRequire(new URL('../packages/editor/package.json', import.meta.url))
const execFileAsync = promisify(execFile)

async function parseSvg(source) {
  const parse = rootRequire('svgo-browser/lib/svgo/svg2js')
  return new Promise((resolve, reject) =>
    parse(source, (result) => {
      if (result.error) reject(new Error(result.error))
      else resolve(result)
    }),
  )
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'markflowy-security-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

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

test('Umi resolves and executes the updated tsx CLI with script arguments', async (t) => {
  const directory = await temporaryDirectory(t)
  const script = path.join(directory, 'smoke.ts')
  await writeFile(
    script,
    'const value: string = process.argv[2]; console.log(JSON.stringify({ value }));',
  )
  const { getBinPath } = zensRequire('@umijs/plugin-run')
  const { stdout } = await execFileAsync(process.execPath, [getBinPath(), script, '安全测试'], {
    timeout: 10_000,
  })
  assert.deepEqual(JSON.parse(stdout), { value: '安全测试' })
})

test('the docs server still serves files and escapes redirect responses', async (t) => {
  const directory = await temporaryDirectory(t)
  await writeFile(path.join(directory, 'fixture.txt'), 'MarkFlowy static file')
  const folderName = 'folder & name'
  await mkdir(path.join(directory, folderName))
  const packRequire = createRequire(zensRequire.resolve('@utoo/pack'))
  const send = packRequire('send')
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    send(req, pathname, { root: directory })
      .on('error', (error) => {
        res.statusCode = error.statusCode || 500
        res.end(error.message)
      })
      .pipe(res)
  })
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const file = await fetch(`${base}/fixture.txt`)
  assert.equal(file.status, 200)
  assert.equal(await file.text(), 'MarkFlowy static file')
  const partial = await fetch(`${base}/fixture.txt`, { headers: { Range: 'bytes=0-3' } })
  assert.equal(partial.status, 206)
  assert.equal(await partial.text(), 'Mark')
  const query = new URLSearchParams({ name: '<img src=x onerror=alert(1)>' })
  const redirect = await fetch(`${base}/${encodeURIComponent(folderName)}?${query}`, {
    redirect: 'manual',
  })
  assert.equal(redirect.status, 301)
  const body = await redirect.text()
  assert.doesNotMatch(body, /<a\b|<img\b/i)
  assert.match(redirect.headers.get('content-security-policy'), /default-src 'none'/)
})

for (const consumer of ['html2sketch', 'mdx-bundler']) {
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

test('the upgraded SVG selector engine preserves SVG adapters and structural selectors', async () => {
  const svg = await parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">
    <g id="shapes"><rect id="first"/><rect id="second" class="accent"/><rect id="third"/></g>
    <g id="other"><circle id="circle"/></g>
  </svg>`)
  const ids = (nodes) => nodes.map((node) => node.attr('id').value)
  assert.deepEqual(ids(svg.querySelectorAll('#shapes > rect:nth-child(2n+1)')), ['first', 'third'])
  assert.equal(svg.querySelector('rect.accent').attr('id').value, 'second')
  assert.equal(svg.querySelector('#second').matches('g > rect:nth-child(2)'), true)
  assert.equal(svg.querySelector('#second').matches('g > rect:nth-child(odd)'), false)
  assert.deepEqual(ids(svg.querySelectorAll('rect + rect')), ['second', 'third'])
  assert.equal(svg.querySelectorAll('missing'), null)
})

test('html2sketch still optimizes SVG geometry and inlines class and attribute styles', async () => {
  const { optimizeRawSVG } = rootRequire('html2sketch/lib/utils/svg')
  const optimized =
    await optimizeRawSVG(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="10">
    <style>.accent { fill: red } rect[id="second"] { fill: blue }</style>
    <rect class="accent" width="10" height="10"/>
    <rect id="second" x="20" width="10" height="10"/>
  </svg>`)
  const svg = await parseSvg(optimized)
  assert.ok(svg.querySelector('path[fill="red"]'))
  assert.ok(svg.querySelector('path[fill="#00f"]'))
  assert.equal(svg.querySelector('style'), null)
})

test('the SVG dependency rejects a pathological nth expression within a bounded child process', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '-e',
      `
    const assert = require('node:assert/strict')
    const { createRequire } = require('node:module')
    const svgRequire = createRequire(require.resolve('svgo-browser'))
    const selectorRequire = createRequire(svgRequire.resolve('css-select'))
    const nth = selectorRequire('nth-check')
    assert.throws(() => nth.parse('2n' + ' '.repeat(100000) + '!'))
    process.stdout.write('rejected')
  `,
    ],
    { timeout: 3_000 },
  )
  assert.equal(stdout, 'rejected')
})
