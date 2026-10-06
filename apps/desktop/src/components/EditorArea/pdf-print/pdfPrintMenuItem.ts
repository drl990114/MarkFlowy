import bus from '@/helper/eventBus'
import type { MenuItemData } from 'zens'

export const PDF_PRINT_EVENT = 'editor_print_pdf'

export function requestPdfPrint(): void {
  bus.emit(PDF_PRINT_EVENT)
}

export function createPdfPrintMenuItem(label: string): MenuItemData {
  return {
    value: 'print_pdf',
    label,
    handler: requestPdfPrint,
  }
}
