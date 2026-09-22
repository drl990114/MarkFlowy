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
  t.after(() => new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections()
  }))
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
    const { code } = await editorRequire('esbuild').transform(markdown, { loader: 'text', format: 'esm' })
    const result = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    assert.equal(result.default, markdown)
  })
}
