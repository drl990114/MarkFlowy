import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'
import { remote } from 'webdriverio'
import MarkdownIt from 'markdown-it'
import { fixtureMarkdown, fixtureValidation } from './fixtures/pdf-export.ts'
import { parseReceipt } from './protocol.ts'

const cases = {
  'a4-outline': { paper: 'a4', landscape: false, outline: true, action: 'save' },
  'a4-no-outline': { paper: 'a4', landscape: false, outline: false, action: 'save' },
  'letter-landscape': { paper: 'letter', landscape: true, outline: true, action: 'save' },
  'save-cancel': { paper: 'a4', landscape: false, outline: true, action: 'cancel' },
  'overwrite-cancel': { paper: 'a4', landscape: false, outline: true, action: 'cancel' },
}
// Quartz can emit a radical's Unicode value for a shared PingFang glyph.
// NFKC handles Kangxi radicals; Unicode's Equivalent_Unified_Ideograph maps
// U+2EDA to U+9875. Fold that known extraction alias only for visual/position
// assertions; retain the raw PDF and report source-absent radicals below.
// https://www.unicode.org/Public/17.0.0/ucd/EquivalentUnifiedIdeograph.txt
const compact = (text) => text.normalize('NFKC').replace(/\u2eda/gu, '页').replace(/\s+/gu, '')

const { values } = parseArgs({
  options: {
    case: { type: 'string' },
    'report-dir': { type: 'string' },
    'reuse-receipt': { type: 'string' },
    port: { type: 'string', default: process.env.TAURI_WEBDRIVER_PORT },
    'timeout-ms': { type: 'string', default: '180000' },
  },
})
assert.equal(process.platform, 'darwin', 'Native picker acceptance currently runs on macOS only')
assert.ok(values.case && Object.hasOwn(cases, values.case), `Choose a case: ${Object.keys(cases).join(', ')}`)
assert.ok(values['report-dir'], 'Supply an explicit --report-dir')
const testCase = values.case
const options = cases[testCase]
const reportDirectory = resolve(values['report-dir'])
const timeout = Number(values['timeout-ms'])
const port = Number(values.port)
assert.ok(Number.isInteger(port) && port > 0 && port < 65536, 'Supply the existing embedded WebDriver port')
assert.ok(Number.isSafeInteger(timeout) && timeout >= 10000 && timeout <= 600000)

const environmentRoot = await realpath(required('MARKFLOWY_E2E_ROOT'))
const id = required('MARKFLOWY_E2E_ID')
assert.match(id, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
assert.equal((await readFile(join(environmentRoot, '.markflowy-e2e'), 'utf8')).trim(), id)
const profile = JSON.parse(await readFile(join(environmentRoot, 'native-profile.json'), 'utf8'))
assert.equal(profile.identifier, `com.drl990114.markflowy.e2e.${id.replaceAll('-', '')}`)
assert.ok(Number.isSafeInteger(profile.pid) && profile.pid > 1)
process.kill(profile.pid, 0)
const binary = await realpath(required('MARKFLOWY_E2E_BINARY'))
const { stdout: ownedProcess } = await promisify(execFile)('ps', [
  'eww', '-p', String(profile.pid), '-o', 'command=',
])
assert.ok(ownedProcess.includes(binary) && ownedProcess.includes(`MARKFLOWY_E2E_ID=${id}`),
  'The running app does not belong to this isolated E2E profile')
await mkdir(reportDirectory, { recursive: true })

// The real editor sanitizes authored HTML styles. Verify bookmarks against the
// resulting page and heading coordinates; use the ordinary document pipeline.
const source = fixtureMarkdown
const sourcePath = join(environmentRoot, 'files', `pdf-export-fixture-${hash(Buffer.from(source)).slice(0, 12)}.md`)
await writeFile(sourcePath, source, { flag: 'wx' }).catch(async (error) => {
  if (error.code !== 'EEXIST') throw error
  assert.equal(await readFile(sourcePath, 'utf8'), source, 'The owned fixture changed unexpectedly')
})
const outputPath = join(environmentRoot, 'files', `${testCase}-${Date.now()}.pdf`)
const sentinel = Buffer.from('%PDF-1.7\nOwned overwrite-cancellation sentinel.\n%%EOF\n')
if (testCase === 'overwrite-cancel') await writeFile(outputPath, sentinel, { flag: 'wx' })
const pending = {
  case: testCase,
  expectedPath: outputPath,
  action: options.action,
  overwrite: testCase === 'overwrite-cancel',
  appPid: profile.pid,
  completed: false,
  instructions: testCase === 'overwrite-cancel'
    ? 'Choose the existing expectedPath, request Save, cancel Replace, then cancel the Save panel.'
    : options.action === 'cancel'
      ? 'Cancel the native Save panel.'
      : 'Save to expectedPath in the native Save panel.',
}

let browser
let result = {
  case: testCase,
  passed: false,
  outputPath,
  sourcePath,
  requestedEngine: 'native',
  nativePickerDrivenExternally: true,
}
try {
  // Connect directly to an already running DEV app. The Tauri service launcher
  // would spawn a second binary, so this intentionally uses W3C WebDriver only.
  browser = await remote({
    hostname: '127.0.0.1',
    port,
    path: '/',
    capabilities: {
      browserName: 'wry',
      'wdio:tauriServiceOptions': { windowLabel: 'main' },
    },
    logLevel: 'error',
    connectionRetryCount: 0,
    connectionRetryTimeout: 20000,
  })
  await browser.switchToWindow('main')
  assert.equal(await browser.execute(() => Boolean(window.__MARKFLOWY_E2E__)), true,
    'Refusing to automate a non-isolated application')
  const location = await browser.getUrl()
  assert.match(location, /^https?:\/\/localhost:3000\//, 'Expected the live Vite DEV application')
  // Each scenario starts with fresh frontend listeners after DEV HMR, while
  // retaining the same isolated native process and profile.
  await browser.refresh()
  await browser.waitUntil(async () => await browser.execute(() => Boolean(window.__MARKFLOWY_E2E__)), {
    timeout: 20000, timeoutMsg: 'The isolated frontend did not reload',
  })
  // Match the normal native E2E startup contract in helpers.ts. The frontend
  // isolation flag can appear before the CLI command registry is ready.
  const runtimeManifestPath = join(environmentRoot, 'runtime', 'runtime.json')
  let runtimeManifest
  await browser.waitUntil(async () => {
    runtimeManifest = await readFile(runtimeManifestPath, 'utf8').then(JSON.parse).catch(() => null)
    return runtimeManifest?.windows?.some((window) => window.id === 'main') &&
      runtimeManifest?.commands?.length > 0
  }, { timeout: 60000, timeoutMsg: 'Native app/CLI startup did not complete' })
  result.cliReadiness = { manifestPath: runtimeManifestPath, windowId: 'main',
    commandCount: runtimeManifest.commands.length }
  const receipt = values['reuse-receipt']
    ? await reuseFixture(values['reuse-receipt'])
    : await openFixture()
  await writeFile(join(reportDirectory, `${testCase}.open-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`)
  await browser.waitUntil(async () => {
    const editor = await browser.$('[data-editor-active="true"] [data-mf-editor-mode]')
    return await editor.isDisplayed() && (await editor.getText()).includes('MarkFlowy PDF Prototype')
  }, { timeout: 60000, timeoutMsg: 'The actual editor did not display the rich fixture' })

  result.frontendErrorsBeforeExport = await browser.execute(() => window.__MARKFLOWY_E2E__?.errors.slice())
  await openExportDialog()
  const dialog = await exportDialog()
  await dialog.$('[role="radio"][value="native"]').click()
  const paper = await dialog.$('button[id$="-paper"]')
  await paper.click()
  await browser.$(`//*[@role='option'][normalize-space(.)='${options.paper === 'a4' ? 'A4' : 'Letter'}']`).click()
  await dialog.$('button[id$="-orientation"]').click()
  await browser.$(`//*[@role='option'][normalize-space(.)='${options.landscape ? 'Landscape' : 'Portrait'}']`).click()
  const outline = await dialog.$('[role="checkbox"]')
  const checked = (await outline.getAttribute('aria-checked')) === 'true'
  if (checked !== options.outline) await outline.click()
  assert.equal(await outline.getAttribute('aria-checked'), String(options.outline))
  await capture('before')
  await observePickerLifecycle()
  await writeFile(join(reportDirectory, 'pending-picker.json'), `${JSON.stringify(pending, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ event: 'native-picker-pending', ...pending })}\n`)
  await dialog.$(".//button[normalize-space(.)='Export PDF']").click()

  if (options.action === 'save') {
    let exportFailure
    await browser.waitUntil(async () => {
      const progress = await browser.execute(() => {
        const frame = document.querySelector('iframe[data-mf-pdf-pagination]')
        const doc = frame?.contentDocument
        return { frame: !!frame, ready: doc?.readyState, paged: !!frame?.contentWindow?.Paged,
          pages: doc?.querySelectorAll('.pagedjs_page').length, fonts: doc?.fonts.status,
          images: [...doc?.images ?? []].map((image) => ({ complete: image.complete,
            width: image.naturalWidth, src: image.src.slice(0, 80) })),
          toasts: [...document.querySelectorAll('[data-sonner-toast]')].map((toast) => toast.textContent) }
      })
      await writeFile(join(reportDirectory, 'export-progress.json'), JSON.stringify(progress, null, 2))
      const saved = await readFile(outputPath).catch((error) => {
        if (error.code === 'ENOENT') return null
        throw error
      })
      if (!saved && !(await (await exportDialog()).isDisplayed())) {
        exportFailure = new Error(`Export closed without a PDF: ${JSON.stringify(progress)}`)
        return true
      }
      return saved?.subarray(0, 5).toString() === '%PDF-' && !(await (await exportDialog()).isDisplayed())
    }, { timeout, interval: 500, timeoutMsg: 'The real export did not finish after native Save' })
    if (exportFailure) throw exportFailure
    const pdf = await verifyPdf(outputPath, options)
    const preserved = join(reportDirectory, `${testCase}.pdf`)
    await copyFile(outputPath, preserved)
    result = { ...result, pdf, preservedPdf: preserved }
  } else {
    await browser.waitUntil(async () => {
      const lifecycle = await pickerLifecycle()
      if (!lifecycle?.busyObserved || !lifecycle.recovered) return false
      const current = await exportDialog()
      return await current.isDisplayed() && await current.$(".//button[normalize-space(.)='Export PDF']").isEnabled()
    }, { timeout, interval: 300, timeoutMsg: 'The export dialog did not recover after native cancellation' })
    if (testCase === 'overwrite-cancel') assert.deepEqual(await readFile(outputPath), sentinel)
    else assert.equal(await stat(outputPath).then(() => true, (error) => {
      if (error.code === 'ENOENT') return false
      throw error
    }), false, 'Cancelling the Save panel must not create a PDF')
    await (await exportDialog()).$(".//button[normalize-space(.)='cancel']").click()
    result = { ...result, cancellationPreservedOutput: true }
  }
  result.pickerLifecycle = await pickerLifecycle()
  assert.equal(result.pickerLifecycle?.busyObserved, true, 'The actual export button never entered its busy state')
  assert.equal(await readFile(sourcePath, 'utf8'), source, 'Export must preserve source bytes')
  const errors = await browser.execute(() => window.__MARKFLOWY_E2E__?.errors)
  result.frontendErrorsAfterExport = errors
  assert.deepEqual(errors, result.frontendErrorsBeforeExport, 'New unhandled frontend exceptions during export')
  await capture('after')
  result.passed = true
} catch (error) {
  result.error = error?.stack ?? String(error)
  await capture('failed')
  process.exitCode = 1
} finally {
  await writeFile(join(reportDirectory, `${testCase}.result.json`), `${JSON.stringify(result, null, 2)}\n`)
  await writeFile(join(reportDirectory, 'pending-picker.json'), `${JSON.stringify({ ...pending, completed: true, passed: result.passed }, null, 2)}\n`)
  await browser?.execute(() => {
    window.__markflowyPdfPickerObservation?.observer.disconnect()
    delete window.__markflowyPdfPickerObservation
  }).catch(() => undefined)
  // Deleting an embedded session leaves the owned DEV app and its window alive.
  await browser?.deleteSession()
}
process.stdout.write(`${JSON.stringify(result)}\n`)

function required(name) {
  const value = process.env[name]
  assert.ok(value, `Missing ${name}`)
  return value
}

async function openFixture() {
  const { stdout } = await promisify(execFile)(binary, [
    'file', 'open', sourcePath, '--window-id', 'main', '--wait', 'applied',
    '--sha256', hash(Buffer.from(source)), '--json', '--timeout', '20000',
  ], { env: process.env, timeout: 25000, maxBuffer: 1024 * 1024 })
  const receipt = parseReceipt(stdout)
  assert.equal(receipt.ok, true, `${receipt.code}: ${receipt.message}`)
  return receipt
}

async function reuseFixture(receiptPath) {
  // A repeated DEV scenario may reuse a CLI-opened document. Require its exact
  // successful receipt, source hash and active editor identity rather than a
  // matching title, which could accidentally select another document.
  const receipt = parseReceipt(await readFile(resolve(receiptPath), 'utf8'))
  assert.equal(receipt.ok, true)
  assert.equal(receipt.result.path, sourcePath)
  assert.equal(receipt.result.contentSha256, hash(Buffer.from(source)))
  assert.equal(receipt.result.windowId, 'main')
  assert.equal(await browser.$('[data-editor-active="true"]').getAttribute('data-editor-id'), receipt.result.fileId)
  return { ...receipt, reusedOwnedFixture: true }
}

async function exportDialog() {
  return browser.$("//*[@role='dialog'][.//*[normalize-space(.)='Export PDF']]")
}

async function openExportDialog() {
  await browser.keys('Escape')
  await browser.waitUntil(async () => {
    for (const button of await browser.$$('button[aria-label="more"][aria-haspopup="menu"]')) {
      if (await button.isDisplayed()) return true
    }
    return false
  }, { timeout: 20000, timeoutMsg: 'The actual editor toolbar did not become ready' })
  const buttons = await browser.$$('button[aria-label="more"][aria-haspopup="menu"]')
  const more = []
  for (const button of buttons) if (await button.isDisplayed()) more.push(button)
  assert.ok(more.length, 'The real editor More menu was not found')
  await more[0].click()
  const pdf = await browser.$("//*[@role='menuitem'][normalize-space(.)='Export PDF']")
  if (!(await pdf.isDisplayed())) {
    // The full editor menu groups export commands in a Radix submenu; compact
    // toolbars expose the same PDF command directly.
    await browser.$("//*[@role='menuitem'][@aria-haspopup='menu'][normalize-space(.)='Export']").click()
    await pdf.waitForDisplayed({ timeout: 10000 })
  }
  await pdf.click()
  await browser.waitUntil(async () => await (await exportDialog()).isDisplayed(), {
    timeout: 60000, timeoutMsg: 'The actual Export PDF dialog did not become visible',
  })
}

async function observePickerLifecycle() {
  await browser.execute(() => {
    window.__markflowyPdfPickerObservation?.observer.disconnect()
    const dialog = [...document.querySelectorAll('[role="dialog"]')]
      .find((element) => element.textContent?.includes('Export PDF'))
    const button = [...dialog?.querySelectorAll('button') ?? []]
      .find((element) => element.textContent?.trim() === 'Export PDF')
    if (!button) throw new Error('The actual Export PDF button was not found')
    const state = { busyObserved: button.disabled, recovered: false }
    // Passively retain the actual disabled -> enabled transition. A native
    // picker may close between WebDriver polls; an enabled button alone cannot
    // establish that a cancellation has happened.
    const observer = new MutationObserver(() => {
      if (button.disabled) state.busyObserved = true
      else if (state.busyObserved) state.recovered = true
    })
    observer.observe(button, { attributes: true, attributeFilter: ['disabled'] })
    window.__markflowyPdfPickerObservation = { state, observer }
  })
}

async function pickerLifecycle() {
  return browser.execute(() => window.__markflowyPdfPickerObservation?.state)
}

async function capture(stage) {
  if (!browser) return
  const captures = await Promise.allSettled([
    browser.saveScreenshot(join(reportDirectory, `${testCase}.${stage}.png`)),
    browser.getPageSource().then((html) => writeFile(join(reportDirectory, `${testCase}.${stage}.html`), html)),
    browser.execute(() => window.__MARKFLOWY_E2E__?.errors)
      .then((errors) => writeFile(join(reportDirectory, `${testCase}.${stage}.errors.json`), JSON.stringify(errors))),
  ])
  result.captures ??= {}
  result.captures[stage] = captures.map((capture) => capture.status === 'fulfilled'
    ? 'saved' : String(capture.reason))
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function verifyPdf(path, settings) {
  const bytes = await readFile(path)
  const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdf.getDocument({ data: Uint8Array.from(bytes), disableFontFace: true })
  try {
    const document = await task.promise
    const pages = []
    const pageTextItems = []
    const linkAnnotations = []
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index)
      const textItems = (await page.getTextContent()).items.filter((item) => 'str' in item)
      pageTextItems.push(textItems)
      linkAnnotations.push(...(await page.getAnnotations()).filter((annotation) => annotation.subtype === 'Link')
        .map((annotation) => ({ page: index, annotation })))
      const text = compact(textItems.map((item) => item.str).join(''))
      assert.ok(text, `Unexpected blank page ${index}`)
      const [width, height] = [page.view[2] - page.view[0], page.view[3] - page.view[1]]
      const expected = settings.paper === 'letter' ? [792, 612] : [595.27559, 841.88976]
      assert.ok(Math.abs(width - expected[0]) < 1 && Math.abs(height - expected[1]) < 1,
        `Wrong paper geometry on page ${index}: ${width} x ${height}`)
      pages.push({ page: index, width, height, text })
    }
    const text = pages.map((page) => page.text).join('\n')
    assert.ok(!text.includes('\uFFFD'), 'The PDF must not contain replacement glyphs')
    for (const required of [...fixtureValidation.requiredText, ...fixtureValidation.diagramLabels]) {
      assert.ok(text.includes(compact(required)), `Missing selectable PDF text: ${required}`)
    }
    for (const row of fixtureValidation.tableRows) {
      assert.equal(text.split(compact(row)).length - 1, 1, `Missing or duplicate table row ${row}`)
    }
    const tablePages = pages.filter((page) => fixtureValidation.tableRows.some((row) => page.text.includes(row)))
    assert.ok(tablePages.length > 1, 'The long table must exercise continuation pages')
    for (const page of tablePages) assert.ok(page.text.includes(fixtureValidation.tableHeader),
      `Table page ${page.page} lost its repeating header`)
    const links = await verifyPdfLinks(document, pages, pageTextItems, linkAnnotations)

    const outline = []
    const consumedMatches = new Map()
    const flatten = async (nodes, depth) => {
      for (const node of nodes) {
        const destination = typeof node.dest === 'string' ? await document.getDestination(node.dest) : node.dest
        assert.ok(destination, `Missing bookmark destination: ${node.title}`)
        const pageIndex = typeof destination[0] === 'number'
          ? destination[0] : await document.getPageIndex(destination[0])
        assert.ok(pages[pageIndex]?.text.includes(compact(node.title)), `Wrong bookmark page: ${node.title}`)
        const [, mode, x, y] = destination
        assert.equal(mode?.name, 'XYZ')
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `Invalid bookmark coordinates: ${node.title}`)
        const page = pages[pageIndex]
        assert.ok(x >= 0 && x <= page.width && y >= 0 && y <= page.height,
          `Bookmark outside page: ${node.title}`)
        const matchKey = `${pageIndex}:${compact(node.title)}`
        const heading = locatePhrase(pageTextItems[pageIndex], node.title, consumedMatches.get(matchKey) ?? 0)
        assert.ok(heading, `Missing printed heading: ${node.title}`)
        consumedMatches.set(matchKey, heading.end)
        assert.ok(Math.abs(x - heading.x) <= 2, `Bookmark x misses its heading: ${node.title}`)
        const baselineGap = y - heading.y
        assert.ok(baselineGap >= -1 && baselineGap <= 2 * heading.height + 2,
          `Bookmark y misses its heading: ${node.title}`)
        outline.push({ title: node.title, depth, page: pageIndex + 1, destination: destination.slice(1) })
        await flatten(node.items, depth + 1)
      }
    }
    await flatten(await document.getOutline() ?? [], 0)
    if (settings.outline) {
      const tokens = new MarkdownIt({ html: true }).parse(source, {})
      const expected = tokens.flatMap((token, index) => token.type === 'heading_open'
        ? [{ title: tokens[index + 1].content, level: Number(token.tag.slice(1)) }] : [])
      assert.deepEqual(outline.map((entry) => compact(entry.title)), expected.map((entry) => compact(entry.title)))
      const levels = []
      const depths = expected.map(({ level }) => {
        while (levels.length && levels.at(-1) >= level) levels.pop()
        const depth = levels.length
        levels.push(level)
        return depth
      })
      assert.deepEqual(outline.map((entry) => entry.depth), depths)
    } else assert.deepEqual(outline, [], 'Outline disabled must omit heading bookmarks')
    const findPhrase = (phrase) => {
      for (const [index, items] of pageTextItems.entries()) {
        const match = locatePhrase(items, phrase)
        if (match) return { page: index + 1, ...match }
      }
      throw new Error(`Missing formula-surrounding text: ${phrase}`)
    }
    const beforeMath = findPhrase('行内公式')
    const afterMath = findPhrase('应与这段中文文字')
    assert.equal(beforeMath.page, afterMath.page)
    assert.ok(Math.abs(beforeMath.y - afterMath.y) <= 1, 'Inline formula must not wrap surrounding prose')
    assert.ok(afterMath.x > beforeMath.endX, 'Inline formula text must continue to its right')
    const nativeText = pageTextItems.flat().map((item) => item.str).join('')
    const sourceAbsentRadicals = [...new Set(nativeText.match(/[\u2e80-\u2fdf]/gu) ?? [])]
      .filter((character) => !source.includes(character))
      .map((character) => ({ character, codePoint: `U+${character.codePointAt(0).toString(16).toUpperCase()}` }))
    return { bytes: bytes.length, sha256: hash(bytes), pageCount: document.numPages, outline, pages, links,
      textExtraction: { sourceAbsentRadicals, exactChineseCodepointsPreserved: sourceAbsentRadicals.length === 0,
        comparisonNormalization: 'NFKC plus Unicode Equivalent_Unified_Ideograph U+2EDA to U+9875; raw PDF unchanged' },
      inlineMathBaseline: { before: beforeMath, after: afterMath } }
  } finally {
    await task.destroy()
  }
}

async function verifyPdfLinks(document, pages, pageTextItems, linkAnnotations) {
  const findPrintedText = (text) => {
    const matches = pageTextItems.flatMap((items, index) => {
      const match = locatePhrase(items, text)
      return match ? [{ page: index + 1, ...match }] : []
    })
    assert.equal(matches.length, 1, `Expected one printed link label or target: ${text}`)
    return matches[0]
  }
  const findSourceAnnotations = (label) => {
    const matches = pageTextItems.flatMap((items, index) => {
      const fragments = locateCjkLinkFragments(items, label)
      return fragments ? [{ page: index + 1, fragments }] : []
    })
    assert.equal(matches.length, 1, `Expected one printed link label: ${label}`)
    const printed = matches[0]
    const annotations = printed.fragments.map((fragment) => {
      const matching = linkAnnotations.filter(({ page, annotation }) => {
        if (page !== printed.page) return false
        const [left, bottom, right, top] = annotation.rect
        return Math.abs(left - fragment.x) <= 2 && Math.abs(right - fragment.endX) <= 2 &&
          bottom <= fragment.y + fragment.height / 2 && top >= fragment.y
      })
      assert.equal(matching.length, 1,
        `Expected one Link rectangle matching the printed fragment ${fragment.text} of ${label}`)
      return matching[0].annotation
    })
    return { printed, annotations }
  }
  // This fixture only authors the listed external URLs. A user-authored
  // external file#fragment is legitimate; it must not be confused with the
  // native renderer's temporary HTML URI for a same-document anchor.
  const allowedExternalUris = new Set(fixtureValidation.links.external.map(({ url }) => url))
  for (const { annotation } of linkAnnotations) {
    for (const uri of [annotation.url, annotation.unsafeUrl].filter(Boolean)) {
      assert.ok(!/^file:/i.test(uri) || allowedExternalUris.has(uri),
        `An unexpected temporary HTML file URI survived PDF export: ${uri}`)
    }
  }
  const internal = []
  for (const { label, targetText } of fixtureValidation.links.internal) {
    const { printed: source, annotations } = findSourceAnnotations(label)
    const target = findPrintedText(targetText)
    let firstDestination
    let firstCoordinates
    for (const annotation of annotations) {
      assert.ok(!annotation.url && !annotation.unsafeUrl, `Internal link retained an external URI: ${label}`)
      const destination = typeof annotation.dest === 'string'
        ? await document.getDestination(annotation.dest) : annotation.dest
      assert.ok(destination, `Missing internal PDF destination: ${label}`)
      const pageIndex = typeof destination[0] === 'number'
        ? destination[0] : await document.getPageIndex(destination[0])
      assert.equal(pageIndex + 1, target.page, `Internal link targets the wrong page: ${label}`)
      const [, mode, x, y] = destination
      assert.equal(mode?.name, 'XYZ', `Internal link requires an XYZ destination: ${label}`)
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `Invalid internal link coordinates: ${label}`)
      assert.ok(x >= 0 && x <= pages[pageIndex].width && y >= 0 && y <= pages[pageIndex].height,
        `Internal link destination outside its page: ${label}`)
      assert.ok(Math.abs(x - target.x) <= 2, `Internal link x misses printed target: ${label}`)
      const baselineGap = y - target.y
      assert.ok(baselineGap >= -1 && baselineGap <= 2 * target.height + 2,
        `Internal link y misses printed target: ${label}`)
      const coordinates = [pageIndex, mode.name, x, y, destination[4] ?? null]
      if (firstDestination) assert.deepEqual(coordinates, firstCoordinates,
        `Fragments of one printed link disagree on their destination: ${label}`)
      else { firstDestination = destination; firstCoordinates = coordinates }
    }
    internal.push({ label, annotationId: annotations[0].id,
      annotationIds: annotations.map((annotation) => annotation.id), sourcePage: source.page,
      sourceRect: annotations[0].rect, sourceRects: annotations.map((annotation) => annotation.rect),
      sourceText: source, targetText, targetPage: target.page, targetPrinted: target,
      destination: firstDestination.slice(1) })
  }
  const external = fixtureValidation.links.external.map(({ label, url }) => {
    const { printed: source, annotations } = findSourceAnnotations(label)
    for (const annotation of annotations) {
      assert.ok(!annotation.dest, `External URL became a local PDF destination: ${label}`)
      assert.equal(annotation.url ?? annotation.unsafeUrl, url, `External URL fragment changed: ${label}`)
    }
    return { label, annotationId: annotations[0].id, annotationIds: annotations.map((annotation) => annotation.id),
      sourcePage: source.page, sourceRect: annotations[0].rect,
      sourceRects: annotations.map((annotation) => annotation.rect), sourceText: source, url }
  })
  return { internal, external, annotationCount: linkAnnotations.length, noTemporaryFileUris: true }
}

function locateCjkLinkFragments(items, label) {
  // These five fixture labels contain only CJK characters. Quartz can combine
  // them with adjacent CJK punctuation in one TextItem or split a link at a
  // line break. Measure only their equal-advance CJK runs, not Latin glyphs.
  const needle = Array.from(compact(label))
  const characters = items.flatMap((item, itemIndex) => Array.from(item.str).flatMap((character, charIndex) =>
    Array.from(compact(character)).map((normalized) => ({ normalized, itemIndex, charIndex }))))
  const starts = characters.flatMap((_, index) => needle.every((character, offset) =>
    characters[index + offset]?.normalized === character) ? [index] : [])
  if (!starts.length) return null
  assert.equal(starts.length, 1, `Expected one printed CJK link label: ${label}`)
  const matched = characters.slice(starts[0], starts[0] + needle.length)
  const fragments = []
  for (const { itemIndex, charIndex } of matched) {
    const item = items[itemIndex]
    const raw = Array.from(item.str)
    assert.ok(raw.every((character) => /^[\p{Unified_Ideograph}\u2e80-\u2fdf\u3000-\u303f\uff00-\uffef]$/u.test(character)),
      `Fixture CJK link measurement encountered a proportional/non-CJK run: ${item.str}`)
    const advance = item.width / raw.length
    const next = { text: raw[charIndex], x: item.transform[4] + charIndex * advance,
      endX: item.transform[4] + (charIndex + 1) * advance, y: item.transform[5], height: item.height }
    const previous = fragments.at(-1)
    if (previous && Math.abs(previous.y - next.y) <= 1 && Math.abs(previous.endX - next.x) <= 2) {
      previous.text += next.text
      previous.endX = next.endX
      previous.height = Math.max(previous.height, next.height)
    } else fragments.push(next)
  }
  return fragments
}

function locatePhrase(items, phrase, from = 0) {
  const needle = compact(phrase)
  const start = items.map((item) => compact(item.str)).join('').indexOf(needle, from)
  if (start < 0) return null
  const end = start + needle.length
  let offset = 0
  const matched = items.filter((item) => {
    const previous = offset
    offset += compact(item.str).length
    return offset > start && previous < end
  })
  const first = matched[0]
  const last = matched.at(-1)
  return { x: first.transform[4], y: first.transform[5], endX: last.transform[4] + last.width,
    height: Math.max(...matched.map((item) => item.height)), end }
}
