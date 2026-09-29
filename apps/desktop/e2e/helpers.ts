import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import { browser, $ } from '@wdio/globals'
import { Key } from 'webdriverio'
import { parseReceipt } from './protocol'

export const root = process.env.MARKFLOWY_E2E_ROOT!
const binary = process.env.MARKFLOWY_E2E_BINARY!
const report = process.env.MARKFLOWY_E2E_REPORT!
export const editor = '[data-editor-active="true"] [data-mf-editor-mode]'
export const sha256 = (content: string) => createHash('sha256').update(content).digest('hex')

export interface FileState {
  fileId?: string
  open: boolean
  active: boolean
  ready: boolean
  visible: boolean
  mode?: string
  dirty: boolean
  conflict: boolean
  contentSha256?: string
  error?: string
}

export async function cli<T>(...args: string[]): Promise<T> {
  const { stdout, stderr } = await promisify(execFile)(binary,
    [...args, '--window-id', 'main', '--json', '--timeout', '10000'],
    { env: process.env, timeout: 15_000, maxBuffer: 1024 * 1024 }).catch(async (error: unknown) => {
      await appendFile(join(report, 'cli-receipts.jsonl'), JSON.stringify({
        args, error: String(error),
        stdout: error && typeof error === 'object' && 'stdout' in error ? error.stdout : null,
        stderr: error && typeof error === 'object' && 'stderr' in error ? error.stderr : null,
      }) + '\n')
      throw error
    })
  await appendFile(join(report, 'cli-receipts.jsonl'), JSON.stringify({ args, stdout, stderr }) + '\n')
  const receipt = parseReceipt<T>(stdout)
  assert.equal(receipt.ok, true, `${receipt.code}: ${receipt.message}`)
  return receipt.result
}

export const status = (path: string) => cli<FileState>('file', 'status', path)

export async function waitState(path: string, expected: Partial<FileState>): Promise<FileState> {
  let state: FileState | undefined
  await browser.waitUntil(async () => {
    // status only inspects. file wait/open would actively refresh and mask watcher failures.
    state = await status(path)
    if (state.error) throw new Error(state.error)
    return Object.entries(expected).every(([key, value]) => state![key as keyof FileState] === value)
  }, { timeoutMsg: `File never reached ${JSON.stringify(expected)}: ${path}` })
  return state!
}

export async function fixture(name: string, content: string): Promise<string> {
  const path = join(root, 'files', `${name}.md`)
  await writeFile(path, content)
  await writeFile(join(report, `${name}.original.md`), content)
  return path
}

export async function openFile(path: string, content: string): Promise<FileState> {
  await cli('file', 'open', path, '--wait', 'applied', '--sha256', sha256(content))
  const state = await waitState(path, { open: true, active: true, ready: true,
    dirty: false, contentSha256: sha256(content), mode: 'wysiwyg' })
  await $(`${editor} [data-mf-capricorn-runtime] [data-cap-content]`).waitForDisplayed()
  await visibleContent(content)
  return state
}

export async function visibleContent(content: string) {
  await browser.waitUntil(async () => (await $(editor).getText()).includes(content),
    { timeoutMsg: `The visible editor did not render ${JSON.stringify(content)}` })
}

export async function shortcut(key: string) {
  await browser.keys([Key.Command, key])
}

export async function replaceDocument(path: string, content: string) {
  await writeFile(join(report, `${basename(path)}.expected-draft.md`), content)
  // Actions include mouse down/up and real coordinates, which the editor uses for its caret.
  await $(`${editor} [data-cap-leaf]`).click({ x: 1, y: 1 })
  await browser.waitUntil(() => browser.execute(() => {
    const key = document.querySelector('[data-editor-active="true"] [data-cap-editable][data-cap-key]')
      ?.getAttribute('data-cap-key')
    return !!key && document.activeElement?.getAttribute('data-cap-dockey') === key
  }), { timeoutMsg: 'The active Capricorn document did not receive keyboard focus' })
  await shortcut('a')
  await browser.keys(Key.Backspace)
  await browser.keys(content)
  await waitState(path, { dirty: true, contentSha256: sha256(content) })
  await visibleContent(content)
}

export async function save(path: string, content: string) {
  await shortcut('s')
  await waitState(path, { dirty: false, contentSha256: sha256(content) })
  assert.equal(await readFile(path, 'utf8'), content)
}

export async function switchMode(mode: 'wysiwyg' | 'sourceCode' | 'preview', path: string) {
  const labels = { wysiwyg: 'Wysiwyg', sourceCode: 'Source Code', preview: 'Preview' }
  const current = await $(editor).getAttribute('data-mf-editor-mode') as keyof typeof labels
  await $(`button[aria-label="${labels[current]}"][aria-haspopup="menu"]`).click()
  await $(`//*[starts-with(@role, 'menuitem')][contains(., '${labels[mode]}')]`).click()
  await waitState(path, { mode, ready: true, active: true })
}

export async function selectTab(fileId: string) {
  await $(`[data-mf-editor-tab-id="${fileId}"]`).click()
}

export async function persistedDraft(path: string, content: string) {
  await browser.waitUntil(() => browser.execute(async (filePath, expected) => {
    const drafts = await window.__TAURI__.core.invoke<{
      document: { path?: string }; content: string
    }[]>('local_history', { operation: 'drafts', payload: { workspace: '' } })
    return drafts.some((draft) => draft.document.path === filePath && draft.content === expected)
  }, path, content), { timeoutMsg: 'The exact unsaved draft was not persisted in native SQLite' })
}

export function installChecks() {
  before(async () => {
    await browser.waitUntil(() => browser.execute(() => !!window.__MARKFLOWY_E2E__ && !!window.__TAURI__),
      { timeout: 60_000, timeoutMsg: 'Expected the isolated native E2E binary' })
    await browser.waitUntil(async () => {
      const runtime = await readFile(join(root, 'runtime', 'runtime.json'), 'utf8')
        .then(JSON.parse).catch(() => null)
      return runtime?.windows?.some((window: { id: string }) => window.id === 'main') &&
        runtime?.commands?.length > 0
    }, { timeout: 60_000, timeoutMsg: 'Native app/CLI startup did not complete' })
  })
  afterEach(async () => {
    const errors = await browser.execute(() => window.__MARKFLOWY_E2E__?.errors)
    assert.deepEqual(errors, [], 'Unhandled frontend exceptions')
  })
}
