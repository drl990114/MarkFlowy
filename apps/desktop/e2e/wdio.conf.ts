import { browser } from '@wdio/globals'
import type { TauriServiceOptions } from '@wdio/tauri-service'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}; run test:e2e instead of invoking wdio directly`)
  return value
}

const outputDir = required('MARKFLOWY_E2E_REPORT')
const serviceOptions: TauriServiceOptions = {
  appBinaryPath: required('MARKFLOWY_E2E_BINARY'),
  driverProvider: 'embedded',
  embeddedPort: Number(required('MARKFLOWY_E2E_PORT')),
  startTimeout: 60_000,
  commandTimeout: 15_000,
  captureBackendLogs: true,
  captureFrontendLogs: false,
}

// failZero is supported by Mocha but absent from WDIO's narrower MochaOpts declaration.
const mochaOpts = {
  // Native WebView round trips accumulate across typing, tab switches and dialogs.
  // Keep individual waits bounded at 20s while allowing the full scenario to finish.
  timeout: 240_000,
  retries: 0,
  failZero: true,
  forbidOnly: true,
  forbidPending: true,
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./specs/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [{ browserName: 'tauri', 'wdio:tauriServiceOptions': serviceOptions }],
  services: [['tauri', serviceOptions]],
  framework: 'mocha',
  reporters: ['spec'],
  outputDir,
  // Never enable debug: upstream launcher debug output includes the inherited environment.
  logLevel: 'warn',
  waitforTimeout: 20_000,
  waitforInterval: 150,
  connectionRetryTimeout: 20_000,
  connectionRetryCount: 0,
  specFileRetries: 0,
  mochaOpts,
  async afterTest(test, _context, result) {
    const name = test.title.replace(/[^a-zA-Z0-9-]/g, '_')
    const captures = await Promise.allSettled([
      browser.saveScreenshot(join(outputDir, `${name}.png`)),
      browser.getPageSource().then((source) => writeFile(join(outputDir, `${name}.html`), source)),
      browser.execute(() => window.__MARKFLOWY_E2E__?.errors ?? ['E2E diagnostics missing'])
        .then((errors) => writeFile(join(outputDir, `${name}.errors.json`), JSON.stringify(errors))),
    ])
    await writeFile(join(outputDir, `${name}.result.json`), JSON.stringify({
      passed: result.passed,
      error: result.error?.stack ?? result.error?.message,
      captures: captures.map((capture) => capture.status === 'fulfilled'
        ? 'saved' : String(capture.reason)),
    }, null, 2))
  },
}
