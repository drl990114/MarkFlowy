import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import bus from '@/helper/eventBus'
import { getFileObject } from '@/helper/files'
import { FileResultCode } from '@/helper/filesys'
import { useCommandStore, useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'zens'
import { MfIconButton } from '../../../../ui-v2/Button'
import { showContextMenu } from '../../../../ui-v2/ContextMenu'

export const MoreActions = () => {
  const { activeId, getEditorContent } = useEditorStore()
  const { execute } = useCommandStore()
  const { t } = useTranslation()
  const ref = useRef<any>(null)
  
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
          bus.emit('editor_set_content', res.content)
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
              execute('edit_bookmark_dialog', curBookMark)
            } else {
              execute('open_bookmark_dialog', curFile)
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
  }, [curFile, execute, t, convertText])

  if (!curFile) return null

  return (
    <MfIconButton
      size='small'
      rounded='smooth'
      iconRef={ref}
      icon={'ri-more-fill'}
      onClick={handleMoreAction}
    />
  )
}
