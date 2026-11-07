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
    nativeOutlineSupported: true,
    checking: false,
    browserInfo: readyBrowser,
    browserSettings: {
      configuredPath: '',
      busy: false,
      onSelect: vi.fn(),
      onReset: vi.fn(),
      onCheck: vi.fn(),
    },
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
  it('offers inline browser configuration only for browser export', () => {
    const { props, rerender } = renderDialog()
    expect(screen.queryByRole('group', { name: 'settings.export.pdf.executable.label' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.select' }))
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.check_again' }))
    expect(props.browserSettings.onSelect).toHaveBeenCalledOnce()
    expect(props.browserSettings.onCheck).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'settings.export.pdf.automatic' })).toBeNull()

    rerender(
      <PdfExportDialog
        {...props}
        browserSettings={{ ...props.browserSettings, configuredPath: '/custom/browser' }}
      />,
    )
    expect(screen.getByText('/custom/browser').getAttribute('title')).toBe('/custom/browser')
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.automatic' }))
    expect(props.browserSettings.onReset).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_native' }))
    expect(screen.queryByText('/custom/browser')).toBeNull()
    expect(screen.queryByRole('group', { name: 'settings.export.pdf.executable.label' })).toBeNull()
  })

  it('keeps invalid browser configuration recoverable while checking', () => {
    const { props } = renderDialog({ checking: true, browserInfo: undefined })
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'settings.export.pdf.check_again' })
        .disabled,
    ).toBe(true)
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.export' }).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.select' }))
    expect(props.browserSettings.onSelect).toHaveBeenCalledOnce()
  })

  it('blocks browser export and configuration during a pending settings write', () => {
    const { props, rerender } = renderDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    rerender(
      <PdfExportDialog
        {...props}
        browserSettings={{
          ...props.browserSettings,
          configuredPath: '/custom/browser',
          busy: true,
        }}
      />,
    )
    for (const name of [
      'settings.export.pdf.select',
      'settings.export.pdf.automatic',
      'settings.export.pdf.check_again',
      'pdf_export.export',
    ]) {
      expect(screen.getByRole<HTMLButtonElement>('button', { name }).disabled).toBe(true)
    }
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.select' }))
    expect(props.browserSettings.onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_native' }))
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.export' }).disabled,
    ).toBe(false)
  })

  it('shows a settings save failure without hiding the retry actions', () => {
    const { props, rerender } = renderDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    rerender(
      <PdfExportDialog
        {...props}
        browserSettings={{ ...props.browserSettings, error: 'Could not save browser' }}
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe('Could not save browser')
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'settings.export.pdf.select' })
        .disabled,
    ).toBe(false)
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_native' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('provides accessible export choices and defaults to in-app A4 portrait export', () => {
    const { props } = renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'pdf_export.title' })
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'pdf_export.method' })).toBeTruthy()
    const native = screen.getByRole('radio', { name: 'pdf_export.method_native' })
    const browser = screen.getByRole('radio', { name: 'pdf_export.method_browser' })
    expect(screen.getAllByRole('radio')).toEqual([native, browser])
    expect(native.getAttribute('aria-checked')).toBe('true')
    expect(browser.getAttribute('aria-checked')).toBe('false')
    for (const [radio, description] of [
      [native, 'pdf_export.native_hint'],
      [browser, 'pdf_export.description'],
    ] as const) {
      const hint = screen.getByText(description)
      expect(hint.id).toBeTruthy()
      expect(radio.getAttribute('aria-describedby')?.split(/\s+/)).toContain(hint.id)
    }
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
      engine: 'native',
      paperSize: 'a4',
      landscape: false,
      includeOutline: true,
    })
  })

  it('exports selected paper, orientation and bookmark preference', async () => {
    const { props } = renderDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    expect(
      screen
        .getByRole('checkbox', { name: 'pdf_export.include_outline' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    await chooseOption('pdf_export.paper_size', 'Letter')
    await chooseOption('pdf_export.orientation', 'pdf_export.landscape')
    fireEvent.click(screen.getByRole('checkbox', { name: 'pdf_export.include_outline' }))
    fireEvent.click(screen.getByRole('button', { name: 'pdf_export.export' }))
    expect(props.onExport).toHaveBeenCalledWith({
      engine: 'browser',
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
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
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
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
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

  it.each(['browser_failed', 'timed_out'])(
    'shows %s diagnostics without describing an installed browser as missing',
    (code) => {
      const { props } = renderDialog({
        browserInfo: {
          available: false,
          compatible: false,
          executablePath: '/usr/bin/chromium',
          error: { code, message: 'The browser could not export.', detail: 'Browser stderr' },
        },
      })
      fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
      const dialog = screen.getByRole('dialog', { name: 'pdf_export.title' })
      expect(screen.getByRole('status').textContent).toBe('pdf_export.browser_check_failed')
      expect(screen.queryByText('pdf_export.browser.not_found')).toBeNull()
      expect(dialog.querySelector('details')?.open).toBe(false)
      expect(dialog.querySelector('pre')?.textContent).toContain(`[${code}]`)
      expect(dialog.querySelector('pre')?.textContent).toContain('/usr/bin/chromium')
      expect(dialog.querySelector('pre')?.textContent).toContain('Browser stderr')
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.export' }).disabled,
      ).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: 'pdf_export.system_print' }))
      expect(props.onPrint).toHaveBeenCalledOnce()
    },
  )

  it.each([
    ['not_found', 'pdf_export.browser.not_found'],
    ['invalid_executable', 'settings.export.pdf.status.invalid_executable'],
    ['unsupported_browser', 'pdf_export.browser.incompatible'],
  ])('distinguishes %s from browser probe failures', (code, status) => {
    renderDialog({
      browserInfo: {
        available: code === 'unsupported_browser',
        compatible: false,
        error: { code, message: 'Browser check result' },
      },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    expect(screen.getByRole('status').textContent).toBe(status)
    if (code === 'not_found') {
      expect(screen.queryByText('pdf_export.browser.error_details')).toBeNull()
    }
  })

  it('does not show a missing-browser status when the controller reports a probe error', () => {
    renderDialog({ browserInfo: undefined, browserCheckError: 'IPC channel closed' })
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    expect(screen.getByRole('status').textContent).toBe('pdf_export.browser_check_failed')
    expect(screen.getByRole('alert').textContent).toBe('IPC channel closed')
  })

  it.each([true, false])('allows in-app export while browser checking is %s', (checking) => {
    const { props } = renderDialog({
      checking,
      browserInfo: {
        available: false,
        compatible: false,
        error: { code: 'browser_failed', message: 'Browser failed', detail: 'Browser stderr' },
      },
      browserCheckError: 'Browser unavailable',
    })
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_native' }))
    expect(screen.getByRole('status').textContent).toBe('pdf_export.native_ready')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('pdf_export.browser.settings_hint')).toBeNull()
    expect(screen.queryByText('pdf_export.browser.error_details')).toBeNull()
    expect(
      screen
        .getByRole('checkbox', { name: 'pdf_export.include_outline' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.getByText('pdf_export.native_hint')).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.export' }).disabled,
    ).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'pdf_export.export' }))
    expect(props.onExport).toHaveBeenCalledWith({
      engine: 'native',
      paperSize: 'a4',
      landscape: false,
      includeOutline: true,
    })
  })

  it('preserves paper and bookmark choices for both export methods', async () => {
    const { props } = renderDialog()
    await chooseOption('pdf_export.paper_size', 'Letter')
    await chooseOption('pdf_export.orientation', 'pdf_export.landscape')
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'pdf_export.include_outline' }))
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_native' }))
    expect(
      screen
        .getByRole('checkbox', { name: 'pdf_export.include_outline' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'pdf_export.export' }))
    expect(props.onExport).toHaveBeenLastCalledWith({
      engine: 'native',
      paperSize: 'letter',
      landscape: true,
      includeOutline: false,
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'pdf_export.include_outline' }))
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    expect(
      screen
        .getByRole('checkbox', { name: 'pdf_export.include_outline' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'pdf_export.export' }))
    expect(props.onExport).toHaveBeenLastCalledWith({
      engine: 'browser',
      paperSize: 'letter',
      landscape: true,
      includeOutline: true,
    })
  })

  it('allows native export without bookmarks on unsupported platforms and preserves the browser choice', () => {
    const { props } = renderDialog({ nativeOutlineSupported: false })
    expect(screen.queryByRole('checkbox', { name: 'pdf_export.include_outline' })).toBeNull()
    expect(screen.queryByText('pdf_export.native_hint')).toBeNull()
    const hint = screen.getByText('pdf_export.native_outline_unavailable')
    expect(
      screen
        .getByRole('radio', { name: 'pdf_export.method_native' })
        .getAttribute('aria-describedby'),
    ).toBe(hint.id)
    fireEvent.click(screen.getByRole('button', { name: 'pdf_export.export' }))
    expect(props.onExport).toHaveBeenLastCalledWith({
      engine: 'native',
      paperSize: 'a4',
      landscape: false,
      includeOutline: false,
    })
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    expect(
      screen
        .getByRole('checkbox', { name: 'pdf_export.include_outline' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('checkbox', { name: 'pdf_export.include_outline' }))
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_native' }))
    expect(screen.queryByRole('checkbox', { name: 'pdf_export.include_outline' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    expect(
      screen
        .getByRole('checkbox', { name: 'pdf_export.include_outline' })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('keeps a busy in-app export cancellable and prevents changing methods', () => {
    const { props, rerender } = renderDialog()
    rerender(<PdfExportDialog {...props} busy error='Native export failed' />)
    expect(screen.getByRole('status').textContent).toBe('pdf_export.exporting')
    expect(screen.getByRole('alert').textContent).toBe('Native export failed')
    for (const radio of screen.getAllByRole<HTMLButtonElement>('radio')) {
      expect(radio.disabled).toBe(true)
    }
    expect(
      screen.getByRole<HTMLButtonElement>('checkbox', { name: 'pdf_export.include_outline' })
        .disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'pdf_export.method_browser' }))
    expect(
      screen.getByRole('radio', { name: 'pdf_export.method_native' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'pdf_export.export' }).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })
})
