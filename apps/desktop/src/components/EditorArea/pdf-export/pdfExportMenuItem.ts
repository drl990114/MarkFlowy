import bus from '@/helper/eventBus'
import type { MenuItemData } from 'zens'

export const PDF_EXPORT_EVENT = 'editor_export_pdf'

export function createPdfExportMenuItem(label: string): MenuItemData {
  return { value: 'export_pdf', label, handler: () => bus.emit(PDF_EXPORT_EVENT) }
}
