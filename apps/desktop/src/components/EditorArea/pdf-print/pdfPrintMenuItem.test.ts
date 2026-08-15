import bus from '@/helper/eventBus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPdfPrintMenuItem, PDF_PRINT_EVENT } from './pdfPrintMenuItem'

describe('createPdfPrintMenuItem', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the localized label and triggers the internal PDF print event', () => {
    const emit = vi.spyOn(bus, 'emit')
    const item = createPdfPrintMenuItem('Print / Export PDF')

    expect(item).toMatchObject({
      label: 'Print / Export PDF',
      value: 'export_pdf',
    })
    if ('handler' in item) item.handler?.()

    expect(emit).toHaveBeenCalledWith(PDF_PRINT_EVENT)
  })
})
