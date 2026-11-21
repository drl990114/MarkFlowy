import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { $, browser } from '@wdio/globals'
import { fixture, installChecks, openFile, shortcut, visibleContent } from '../helpers'

async function openThemeSettings() {
  await shortcut(',')
  const search = await $('#setting-search')
  await search.waitForDisplayed()
  await search.setValue('Theme Mode')
  await $('//nav//button[contains(., "Theme Mode")]').click()
}

async function selectMode(mode: 'light' | 'dark' | 'system') {
  const radio = await $(`[data-setting-key="theme_mode"] [role="radio"][value="${mode}"]`)
  await radio.scrollIntoView({ block: 'center' })
  await radio.click()
}

async function markDocument() {
  const id = randomUUID()
  await browser.execute((marker) => {
    document.documentElement.dataset.e2eDocumentId = marker
  }, id)
  return id
}

async function expectTheme(mode: 'light' | 'dark' | 'system', documentId: string) {
  await browser.waitUntil(() => browser.execute(async (expected) => {
    const settings = await window.__TAURI__.core.invoke<{ theme_mode: string }>('get_app_conf')
    const resolved = expected === 'system'
      ? await window.__TAURI__.core.invoke<string>('get_system_theme')
      : expected
    const root = document.documentElement
    return settings.theme_mode === expected &&
      root.dataset.mfTheme === resolved && root.style.colorScheme === resolved
  }, mode), { timeoutMsg: `The open window did not apply the saved ${mode} theme` })
  assert.equal(await browser.execute(() => document.documentElement.dataset.e2eDocumentId), documentId,
    'The document reloaded')
  assert.deepEqual(await browser.execute(() => window.__MARKFLOWY_E2E__?.errors), [])
}

describe('shared theme selection', () => {
  installChecks()

  it('applies changes from either window to both open documents', async () => {
    const mainText = 'First theme document'
    await openFile(await fixture('theme-main', mainText), mainText)
    const mainDocument = await markDocument()
    const initial = await browser.execute(() => document.documentElement.dataset.mfTheme)
    assert.ok(initial === 'light' || initial === 'dark')
    const opposite = initial === 'light' ? 'dark' : 'light'
    const otherText = 'Second theme document'
    const path = await fixture('theme-other', otherText)
    const other = await browser.execute((file) =>
      window.__TAURI__.core.invoke<string>('create_new_window', { path: file }), path)
    assert.notEqual(other, 'main')
    await browser.switchToWindow(other)
    await visibleContent(otherText)
    const otherDocument = await markDocument()
    assert.equal(await browser.execute(() => document.documentElement.dataset.mfTheme), initial)

    await openThemeSettings()
    await selectMode(opposite)
    await expectTheme(opposite, otherDocument)
    await browser.switchToWindow('main')
    await expectTheme(opposite, mainDocument)

    await openThemeSettings()
    await selectMode(initial)
    await expectTheme(initial, mainDocument)
    await browser.switchToWindow(other)
    await expectTheme(initial, otherDocument)

    await selectMode('system')
    await expectTheme('system', otherDocument)
    await browser.switchToWindow('main')
    await expectTheme('system', mainDocument)
  })
})
