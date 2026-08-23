import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatPandocErrorDetails,
  normalizePandocError,
  PandocExportErrorDetails,
} from './PandocExportErrorDetails'

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ writeText: vi.fn() }))

const labels = {
  code: 'Error code',
  exitCode: 'Exit code',
  message: 'Message',
  details: 'Details',
}

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('PandocExportErrorDetails', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.mocked(writeText).mockReset().mockResolvedValue()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('formats the stable code, exit code, backend message, and stderr detail', () => {
    const details = formatPandocErrorDetails(
      {
        code: 'conversion_failed',
        message: 'Could not fetch resource',
        detail: '[WARNING] image path is missing',
        exitCode: 64,
      },
      'Pandoc could not convert this document.',
      labels,
    )

    expect(details).toContain('Error code: conversion_failed')
    expect(details).toContain('Exit code: 64')
    expect(details).toContain('Message:\nCould not fetch resource')
    expect(details).toContain('Details:\n[WARNING] image path is missing')
  })

  it('normalizes unexpected errors without hiding their original detail', () => {
    const error = new Error('IPC channel closed')
    const normalized = normalizePandocError(error, 'Conversion failed')

    expect(normalized.code).toBe('conversion_failed')
    expect(normalized.message).toBe('IPC channel closed')
    expect(normalized.detail).toContain('Error: IPC channel closed')
  })

  it('constrains long text and copies the complete detail', async () => {
    const details = `conversion_failed\n${'x'.repeat(10_000)}`
    await act(async () => {
      root.render(
        <PandocExportErrorDetails
          copiedLabel='Copied'
          copyFailedLabel='Copy failed'
          copyLabel='Copy error details'
          details={details}
        />,
      )
    })

    const detailPanel = container.querySelector('pre')
    expect(detailPanel?.textContent).toBe(details)
    expect(detailPanel?.className).toContain('max-h-[50vh]')
    expect(detailPanel?.className).toContain('overflow-auto')
    expect(detailPanel?.className).toContain('whitespace-pre-wrap')
    expect(detailPanel?.className).toContain('break-all')

    const copyButton = container.querySelector<HTMLButtonElement>('button')
    await act(async () => {
      copyButton?.click()
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(details))
    })

    expect(copyButton?.textContent).toContain('Copied')
  })

  it('keeps the dialog usable when clipboard access fails', async () => {
    vi.mocked(writeText).mockRejectedValue(new Error('clipboard denied'))
    await act(async () => {
      root.render(
        <PandocExportErrorDetails
          copiedLabel='Copied'
          copyFailedLabel='Copy failed'
          copyLabel='Copy error details'
          details='full error detail'
        />,
      )
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click()
      await Promise.resolve()
    })

    await vi.waitFor(() => expect(container.querySelector('[role=status]')).not.toBeNull())
    expect(container.querySelector('[role=status]')?.textContent).toBe('Copy failed')
    expect(container.querySelector('pre')?.textContent).toBe('full error detail')
  })
})
