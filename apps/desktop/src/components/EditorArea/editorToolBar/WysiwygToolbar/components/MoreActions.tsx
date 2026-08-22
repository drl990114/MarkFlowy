import { commandRegistry } from '@/commands'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import bus from '@/helper/eventBus'
import { getFileObject } from '@/helper/files'
import { FileResultCode } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { EllipsisIcon } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from '@/i18n'
import { toast } from 'zens'
import { EditorAreaActionButton } from '../../../EditorAreaAction'
import { showContextMenu } from '../../../../ui-v2/ContextMenu'
import { createPdfPrintMenuItem } from '../../../pdf-print/pdfPrintMenuItem'

export const MoreActions = () => {
  const activeId = useEditorStore((state) => state.activeId)
  const getEditorContent = useEditorStore((state) => state.getEditorContent)
  const { t } = useTranslation()
  const ref = useRef<HTMLButtonElement>(null)

  const curFile = activeId ? getFileObject(activeId) : undefined

  const convertText = useCallback(
    async (variant: string) => {
      const content = getEditorContent(curFile?.id || '')
      try {
        const res = await invoke<{ code: FileResultCode; content: string }>('convert_text', {
          text: content || '',
          variant,
        })
        if (res.code === FileResultCode.Success) {
          bus.emit('editor_set_content', undefined, res.content)
        } else {
          toast.error(res.content)
        }
      } catch (error) {
        toast.error(String(error))
      }
    },
    [curFile?.id, getEditorContent],
  )

  const handleMoreAction = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return
    const { findMark } = useBookMarksStore.getState()
    const curBookMark = findMark(curFile?.path || '')

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items: [
        {
          label: t('action.bookmark'),
          value: 'BookMark',
          checked: curBookMark !== undefined,
          handler: () => {
            if (curBookMark) {
              commandRegistry.execute('edit_bookmark_dialog', curBookMark)
            } else {
              commandRegistry.execute('open_bookmark_dialog', curFile)
            }
          },
        },
        {
          type: 'divider' as const,
        },
        {
          value: 'export_html',
          label: t('contextmenu.editor_tab.export_html'),
          handler: () => {
            bus.emit('editor_export_html')
          },
        },
        createPdfPrintMenuItem(t('contextmenu.editor_tab.export_pdf')),
        {
          value: 'export_image',
          label: t('contextmenu.editor_tab.export_image'),
          handler: () => {
            bus.emit('editor_export_image')
          },
        },
        {
          type: 'divider' as const,
        },
        {
          label: '简繁转换',
          value: 'convert_text',
          children: [
            {
              label: '简 -> 繁 (台湾)',
              value: 'zh-TW',
              handler: () => convertText('zh-TW'),
            },
            {
              label: '简 -> 繁 (香港)',
              value: 'zh-HK',
              handler: () => convertText('zh-HK'),
            },
            {
              label: '繁 -> 简',
              value: 'zh-Hans',
              handler: () => convertText('zh-Hans'),
            },
          ],
        },
      ],
    })
  }, [curFile, t, convertText])

  if (!curFile) return null

  return (
    <EditorAreaActionButton
      aria-haspopup='menu'
      icon={EllipsisIcon}
      label={t('action.more')}
      onClick={handleMoreAction}
      ref={ref}
    />
  )
}
