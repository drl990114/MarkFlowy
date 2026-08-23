import { invoke } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  exportMarkdownWithPandoc,
  getPandocExportFileName,
  isPandocError,
  probePandoc,
  supportsPandocFormat,
} from './pandocExport'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

describe('Pandoc export IPC', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
  })

  it('preserves multi-dot Markdown file names for each output format', () => {
    expect(getPandocExportFileName('report.v2.md', 'docx')).toBe('report.v2.docx')
    expect(getPandocExportFileName('notes.markdown', 'odt')).toBe('notes.odt')
    expect(getPandocExportFileName('untitled', 'epub')).toBe('untitled.epub')
  })

  it('maps probing and export requests to the restricted Tauri commands', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ available: false }).mockResolvedValueOnce({
      outputPath: '/tmp/report.docx',
      warnings: [],
    })

    await probePandoc('/opt/pandoc')
    const request = {
      source: '# Unsaved',
      format: 'docx' as const,
      outputPath: '/tmp/report.docx',
      executablePath: '/opt/pandoc',
      resourcePaths: ['/workspace/docs'],
    }
    await exportMarkdownWithPandoc(request)

    expect(invoke).toHaveBeenNthCalledWith(1, 'probe_pandoc', {
      executablePath: '/opt/pandoc',
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'export_markdown_with_pandoc', { request })
  })

  it('recognizes only stable Pandoc errors and advertised formats', () => {
    expect(isPandocError({ code: 'timed_out', message: 'timeout' })).toBe(true)
    expect(isPandocError({ code: 'arbitrary_command', message: 'unsafe' })).toBe(false)
    expect(
      supportsPandocFormat(
        {
          available: true,
          compatible: true,
          executablePath: '/opt/pandoc',
          supportedFormats: ['docx', 'odt'],
        },
        'docx',
      ),
    ).toBe(true)
    expect(
      supportsPandocFormat(
        {
          available: true,
          compatible: true,
          executablePath: '/opt/pandoc',
          supportedFormats: ['docx', 'odt'],
        },
        'epub',
      ),
    ).toBe(false)
  })
})
