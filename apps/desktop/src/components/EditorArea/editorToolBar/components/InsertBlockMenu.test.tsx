import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { InsertBlockMenu } from './InsertBlockMenu'

const mocks = vi.hoisted(() => ({
  target: { fileId: 'file', groupId: 'left' },
  capture: vi.fn(),
  execute: vi.fn(),
  release: vi.fn(),
  unavailable: vi.fn(),
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/extensions/command-palette/editorCommands', () => ({
  captureEditorCommandTarget: mocks.capture,
  editorCommandUnavailable: mocks.unavailable,
  executeEditorPaletteCommand: mocks.execute,
  releaseEditorCommandTarget: mocks.release,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.capture.mockReturnValue(mocks.target)
  mocks.execute.mockResolvedValue(true)
  mocks.unavailable.mockReturnValue(undefined)
})
afterEach(cleanup)

function openMenu() {
  render(<TooltipProvider><InsertBlockMenu editorId='file' groupId='left' /></TooltipProvider>)
  fireEvent.keyDown(screen.getByRole('button', { name: 'toolbar.insert' }), { key: 'ArrowDown' })
}

describe('compact block insertion menu', () => {
  it.each([
    ['toolbar.codeBlock', 'editor_insertCodeBlock'],
    ['toolbar.mathBlock', 'editor_insertMathBlock'],
  ])('executes %s against the captured toolbar pane', async (label, command) => {
    openMenu()
    expect(mocks.capture).toHaveBeenCalledWith({ fileId: 'file', groupId: 'left' })
    fireEvent.click(screen.getByRole('menuitem', { name: label }))
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(mocks.target, command))
    await waitFor(() => expect(mocks.release).toHaveBeenCalledWith(mocks.target))
  })

  it('leaves unavailable insertion actions disabled', () => {
    mocks.unavailable.mockReturnValue('read_only')
    openMenu()
    const item = screen.getByRole('menuitem', { name: 'toolbar.codeBlock' })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(item)
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('allows the command to restore editor focus after the menu closes', async () => {
    const editorInput = document.createElement('textarea')
    document.body.append(editorInput)
    mocks.execute.mockImplementation(async () => {
      editorInput.focus()
      return true
    })
    try {
      openMenu()
      fireEvent.click(screen.getByRole('menuitem', { name: 'toolbar.codeBlock' }))
      await waitFor(() => expect(document.activeElement).toBe(editorInput))
      expect(screen.queryByRole('menu')).toBeNull()
    } finally {
      editorInput.remove()
    }
  })

  it('releases the bookmark on dismissal without editing', async () => {
    openMenu()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await waitFor(() => expect(mocks.release).toHaveBeenCalledWith(mocks.target))
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})
