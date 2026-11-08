import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'

const run = promisify(execFile)
const caseNames = ['a4-outline', 'a4-no-outline', 'letter-landscape']
const { values } = parseArgs({
  options: {
    'a4-outline': { type: 'string' },
    'a4-no-outline': { type: 'string' },
    'letter-landscape': { type: 'string' },
    'output-dir': { type: 'string' },
    'scale-to': { type: 'string', default: '1800' },
    help: { type: 'boolean', default: false },
  },
})

if (values.help) {
  process.stdout.write('Render three existing native PDF exports with Poppler.\n' +
    'Usage: node pdf-export-visual-qa.mjs --a4-outline FILE --a4-no-outline FILE ' +
    '--letter-landscape FILE --output-dir NEW_DIRECTORY [--scale-to 1800]\n' +
    'The output directory must be new. Rendering does not complete visual review.\n')
} else {
  await main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`)
    process.exitCode = 1
  })
}

async function main() {
  assert.ok(values['output-dir'], 'Supply a new --output-dir')
  const outputDirectory = resolve(values['output-dir'])
  const scaleTo = Number(values['scale-to'])
  assert.ok(Number.isInteger(scaleTo) && scaleTo >= 600 && scaleTo <= 4000,
    '--scale-to must be an integer between 600 and 4000')
  const sources = []
  for (const name of caseNames) {
    assert.ok(values[name], `Supply the real --${name} PDF`)
    const path = await realpath(resolve(values[name]))
    const bytes = await readFile(path)
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', `Not a PDF: ${path}`)
    const info = await run('pdfinfo', [path], { timeout: 30000, maxBuffer: 1024 * 1024 })
    const pageCount = Number(info.stdout.match(/^Pages:\s+(\d+)\s*$/m)?.[1])
    assert.ok(Number.isInteger(pageCount) && pageCount > 0,
      `Poppler could not read the PDF page count: ${path}`)
    sources.push({
      case: name,
      path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      pageCount,
      pdfInfo: info.stdout,
      pdfInfoWarnings: info.stderr,
    })
  }
  assert.equal(new Set(sources.map((source) => source.path)).size, caseNames.length,
    'Supply three distinct exported PDF files')
  const tools = await Promise.all(['pdfinfo', 'pdftoppm'].map(async (command) => {
    const version = await run(command, ['-v'], { timeout: 10000, maxBuffer: 1024 * 1024 })
    return { command, version: `${version.stdout}\n${version.stderr}`.trim().split('\n')[0] }
  }))

  // Refuse an existing directory so stale page PNGs cannot enter this report.
  await mkdir(outputDirectory)
  const manifestPath = join(outputDirectory, 'manifest.json')
  const manifest = {
    createdAt: new Date().toISOString(),
    operation: 'Render existing PDFs to PNG; no PDF generation or modification',
    renderStatus: 'in-progress',
    visualReview: 'pending',
    scaleTo,
    tools,
    documents: [],
  }
  const save = () => writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await save()
  try {
    for (const source of sources) {
      // Hash again after rendering to catch a changed source during inspection.
      const directory = join(outputDirectory, source.case)
      await mkdir(directory)
      await writeFile(join(directory, 'pdfinfo.txt'), source.pdfInfo)
      const rendered = await run('pdftoppm', [
        '-png', '-scale-to', String(scaleTo), source.path, join(directory, 'page'),
      ], { timeout: 180000, maxBuffer: 4 * 1024 * 1024 })
      const files = (await readdir(directory)).filter((file) => /^page-\d+\.png$/.test(file))
        .sort((left, right) => pageNumber(left) - pageNumber(right))
      assert.equal(files.length, source.pageCount, `${source.case}: rendered page count differs`)
      const pages = []
      for (const [index, file] of files.entries()) {
        assert.equal(pageNumber(file), index + 1, `${source.case}: page numbers are not contiguous`)
        const imagePath = join(directory, file)
        const bytes = await readFile(imagePath)
        assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          `Poppler did not produce a PNG: ${imagePath}`)
        assert.equal(bytes.subarray(12, 16).toString(), 'IHDR', `Missing PNG dimensions: ${imagePath}`)
        const width = bytes.readUInt32BE(16)
        const height = bytes.readUInt32BE(20)
        assert.ok(width > 0 && height > 0, `Empty rendered page: ${imagePath}`)
        pages.push({ page: index + 1, path: imagePath, width, height, bytes: bytes.length })
      }
      const current = await readFile(source.path)
      assert.equal(createHash('sha256').update(current).digest('hex'), source.sha256,
        `PDF changed during visual QA: ${source.path}`)
      manifest.documents.push({ ...source, pages, renderWarnings: rendered.stderr })
      await save()
    }
    manifest.renderStatus = 'complete'
    await save()
    process.stdout.write(`Rendered ${sources.reduce((sum, source) => sum + source.pageCount, 0)} pages. ` +
      `Visual review is pending. Manifest: ${manifestPath}\n`)
  } catch (error) {
    manifest.renderStatus = 'failed'
    manifest.error = String(error.stack ?? error)
    await save()
    throw error
  }
}

function pageNumber(file) {
  return Number(file.match(/-(\d+)\.png$/)?.[1])
}
