import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PdfExportDialog, type PdfExportDialogProps } from './PdfExportDialog'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

afterEach(cleanup)

const readyBrowser = { available: true, compatible: true, version: '130' }

function renderDialog(overrides: Partial<PdfExportDialogProps> = {}) {
  const props: PdfExportDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    onExport: vi.fn(),
    onPrint: vi.fn(),
    busy: false,
    checking: false,
    browserInfo: readyBrowser,
    ...overrides,
  }
  return { props, ...render(<PdfExportDialog {...props} />) }
}

async function chooseOption(label: string, option: string) {
  const trigger = screen.getByRole('combobox', { name: label })
  fireEvent.keyDown(trigger, { key: 'Enter' })
  const item = await screen.findByRole('option', { name: option })
  fireEvent.keyDown(item, { key: 'Enter' })
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
}

describe('PDF export dialog', () => {
  it('provides accessible labels and exports A4 portrait with bookmarks by default', () => {
    const { props } = renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'pdf_export.title' })
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'pdf_export.paper_size' }).textContent).toContain(
      'A4',
    )
    expect(
      screen
        .getByRole('checkbox', { name: 'pdf_export.include_outline' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'pdf_export.export' }))
    expect(props.onExport).toHaveBeenCalledWith({
      paperSize: 'a4',
      landscape: false,
      includeOutline: true,
    })
  })

  it('exports selected paper, orientation and bookmark preference', async () => {
    const { props } = renderDialog()
    await chooseOption('pdf_export.paper_size', 'Letter')
    await chooseOption('pdf_export.orientation', 'pdf_export.landscape')
    fireEvent.click(screen.getByRole('checkbox', { name: 'pdf_export.include_outline' }))
    fireEvent.click(screen.getByRole('button', { name: 'pdf_export.export' }))
    expect(props.onExport).toHaveBeenCalledWith({
      paperSize: 'letter',
      landscape: true,
      includeOutline: false,
    })
  })

  it.each([
    undefined,
    { available: false, compatible: false },
    { available: true, compatible: false },
  ])('blocks export without a compatible browser and allows system print: %j', (browserInfo) => {
    const { props } = renderDialog({ browserInfo })
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.export' }).disabled,
    ).toBe(true)
    expect(screen.getByText('pdf_export.system_print_hint')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'pdf_export.system_print' }))
    expect(props.onPrint).toHaveBeenCalledOnce()
    expect(props.onExport).not.toHaveBeenCalled()
  })

  it('blocks export while checking and keeps busy work cancellable', () => {
    const { props, rerender } = renderDialog({ checking: true })
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.export' }).disabled,
    ).toBe(true)
    rerender(<PdfExportDialog {...props} checking={false} busy error='Export failed' />)
    expect(screen.getByRole('status').textContent).toBe('pdf_export.exporting')
    expect(screen.getByRole('alert').textContent).toBe('Export failed')
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.export' }).disabled,
    ).toBe(true)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.system_print' }).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(props.onOpenChange).toHaveBeenCalledTimes(2)
  })
})
