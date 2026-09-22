import { describe, expect, it } from 'vitest'
import { FileSaveCoordinator } from './fileSaveCoordinator'
import {
  assertValidUnicode,
  DEFAULT_TEXT_METADATA,
  textLineEndings,
  type TextFileFormat,
} from './textFileFormat'

const gbk: TextFileFormat = { encoding: 'gbk', bom: 'none' }
const utf16: TextFileFormat = { encoding: 'utf-16le', bom: 'utf16le' }

describe('file content and format snapshots', () => {
  it('captures format with content and retries a format change during an in-flight write', async () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.loadSnapshot('f', {
      content: '中文',
      revision: 'disk:0',
      status: 'success',
      text: { ...DEFAULT_TEXT_METADATA, format: gbk },
    })
    coordinator.recordContent('f', '修改')
    const attempts: TextFileFormat[] = []
    let finish!: () => void
    const task = coordinator.saveLatest('f', async (snapshot) => {
      attempts.push(snapshot.textOptions.format)
      if (attempts.length === 1)
        await new Promise<void>((resolve) => {
          finish = resolve
        })
      coordinator.acknowledgeSaved('f', snapshot, `disk:${attempts.length}`)
      return true
    })
    await Promise.resolve()
    coordinator.recordFormat('f', utf16)
    finish()
    expect(await task).toBe(true)
    expect(attempts).toEqual([gbk, utf16])
    expect(coordinator.isAtSavedSnapshot('f')).toBe(true)
    expect(coordinator.getWriteOptions('f').originalFormat).toEqual(utf16)
  })

  it('treats BOM-only edits as dirty and recognizes reverting text plus format', () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.loadSnapshot('f', {
      content: 'original',
      revision: 'disk',
      status: 'success',
      text: DEFAULT_TEXT_METADATA,
    })
    coordinator.recordFormat('f', { encoding: 'utf-8', bom: 'utf8' })
    expect(coordinator.hasFormatChanges('f')).toBe(true)
    expect(coordinator.isAtSavedSnapshot('f')).toBe(false)
    coordinator.recordContent('f', 'changed')
    coordinator.recordFormat('f', DEFAULT_TEXT_METADATA.format)
    expect(coordinator.isAtSavedSnapshot('f')).toBe(false)
    coordinator.recordContent('f', 'original')
    expect(coordinator.isAtSavedSnapshot('f')).toBe(true)
  })

  it('does not turn inferred or unknown encoding into a confirmed recovery format', () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.loadSnapshot('f', {
      content: '中文',
      revision: 'disk',
      status: 'success',
      text: {
        ...DEFAULT_TEXT_METADATA,
        format: gbk,
        decoding: { source: 'heuristic', needsConfirmation: true, byteRoundTrip: true },
      },
    })
    expect(coordinator.getWriteOptions('f').encodingConfirmed).toBe(false)
    expect(coordinator.getPersistedFormat('f')).toBeUndefined()
    coordinator.recordFormat('f', gbk)
    expect(coordinator.getPersistedFormat('f')).toEqual(gbk)
    expect(coordinator.getWriteOptions('f').encodingConfirmed).toBe(true)
  })

  it('rejects isolated surrogates before IPC and counts CRLF only once', () => {
    expect(() => assertValidUnicode('中😀\r\n')).not.toThrow()
    expect(() => assertValidUnicode('a\ud800')).toThrow('Unicode')
    expect(() => assertValidUnicode('\udfff')).toThrow('Unicode')
    expect(textLineEndings('a\r\nb\nc\r\r\n')).toEqual({ lf: 1, crlf: 2, cr: 1 })
  })
})
