import bus from '@/helper/eventBus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPandocExportMenuItem,
  PANDOC_EXPORT_EVENT,
} from './pandocExportMenuItem'

describe('createPandocExportMenuItem', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses one localized submenu and emits the selected whitelisted format', () => {
    const emit = vi.spyOn(bus, 'emit')
    const item = createPandocExportMenuItem((key) => key)

    expect(item).toMatchObject({
      value: 'export_pandoc',
      label: 'contextmenu.editor_tab.export_pandoc',
      children: [
        { value: 'export_pandoc_docx' },
        { value: 'export_pandoc_odt' },
        { value: 'export_pandoc_epub' },
      ],
    })

    const epubItem = 'children' in item ? item.children?.[2] : undefined
    if (epubItem && 'handler' in epubItem) epubItem.handler?.()

    expect(emit).toHaveBeenCalledWith(PANDOC_EXPORT_EVENT, undefined, 'epub')
  })
})
