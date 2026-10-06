import bus from '@/helper/eventBus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPdfPrintMenuItem, PDF_PRINT_EVENT } from './pdfPrintMenuItem'

describe('createPdfPrintMenuItem', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the localized label and triggers the internal PDF print event', () => {
    const emit = vi.spyOn(bus, 'emit')
    const item = createPdfPrintMenuItem('Print')

    expect(item).toMatchObject({
      label: 'Print',
      value: 'print_pdf',
    })
    if ('handler' in item) item.handler?.()

    expect(emit).toHaveBeenCalledWith(PDF_PRINT_EVENT)
  })
})
