import bus from '@/helper/eventBus'
import type { MenuItemData } from 'zens'
import type { PandocOutputFormat } from './pandocExport'

export const PANDOC_EXPORT_EVENT = 'editor_export_pandoc'

type Translate = (key: string) => string

export function requestPandocExport(format: PandocOutputFormat): void {
  bus.emit(PANDOC_EXPORT_EVENT, undefined, format)
}

export function createPandocExportMenuItem(t: Translate): MenuItemData {
  return {
    value: 'export_pandoc',
    label: t('contextmenu.editor_tab.export_pandoc'),
    children: [
      {
        value: 'export_pandoc_docx',
        label: t('contextmenu.editor_tab.export_pandoc_docx'),
        handler: () => requestPandocExport('docx'),
      },
      {
        value: 'export_pandoc_odt',
        label: t('contextmenu.editor_tab.export_pandoc_odt'),
        handler: () => requestPandocExport('odt'),
      },
      {
        value: 'export_pandoc_epub',
        label: t('contextmenu.editor_tab.export_pandoc_epub'),
        handler: () => requestPandocExport('epub'),
      },
    ],
  }
}
