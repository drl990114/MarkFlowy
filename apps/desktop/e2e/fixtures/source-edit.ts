import { browser, $ } from '@wdio/globals'
import { fixture, openFile, sha256, shortcut, switchMode, waitState } from '../helpers'

const sourceBody = '[data-editor-active="true"] [data-mf-editor-mode="sourceCode"] .cm-content'
const original = '# Hidden Watch QA\n\nWatching the new inode 140\n'
const local = '# Hidden Watch QA\n\nLocal unsaved QA 140\n'
export const externalSource = '# Hidden Watch QA\n\nExternal conflict version 140\n'

export async function visibleSource(content: string) {
  await $(sourceBody).waitForDisplayed()
  await browser.waitUntil(
    () => browser.execute((selector, expected) => {
      const lines = document.querySelectorAll(selector + ' > .cm-line')
      const rendered = Array.from(lines, (line) => line.textContent).join('\n')
      return lines.length > 0 && rendered === expected
    }, sourceBody, content),
    { timeoutMsg: `Source editor did not display ${JSON.stringify(content)}` },
  )
}

export async function openShortenedSource(name: string) {
  const path = await fixture(name, original)
  await openFile(path, original, 'Watching the new inode 140')
  await switchMode('sourceCode', path)
  await visibleSource(original)
  await $(sourceBody).click()
  await shortcut('a')
  // Deliver one paste to the focused editor without changing the system clipboard.
  await browser.execute((selector, text) => {
    const body = document.querySelector(selector)
    if (!body || body !== document.activeElement) throw new Error('Source editor lost focus before paste')
    const data = new DataTransfer()
    data.setData('text/plain', text)
    body.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true, cancelable: true, clipboardData: data,
    }))
  }, sourceBody, local)
  await waitState(path, { dirty: true, conflict: false, contentSha256: sha256(local) })
  await visibleSource(local)
  return { path, local }
}
