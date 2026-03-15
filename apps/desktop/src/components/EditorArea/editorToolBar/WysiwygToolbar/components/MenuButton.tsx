import { MfIconLabelButton } from '@/components/ui-v2/Button/icon-label-button'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import bus from '@/helper/eventBus'
import { getFileObject } from '@/helper/files'
import { FileResultCode } from '@/helper/filesys'
import { currentWindow } from '@/services/windows'
import { useCommandStore, useEditorStateStore, useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import NiceModal from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorViewType } from 'rme'
import { Space, toast } from 'zens'
import { MODAL_INFO_ID } from '../../../../Modal'
import { showContextMenu } from '../../../../ui-v2/ContextMenu'

type FileNormalInfo = {
  size: string
  last_modified: string
}

const EMPTY_FILE_NORMAL_INFO: FileNormalInfo = {
  size: '',
  last_modified: '',
}

export const MenuButton = memo(() => {
  const { activeId, getEditorContent } = useEditorStore()
  const { execute } = useCommandStore()
  const { editorViewTypeMap } = useEditorViewTypeStore()
  const { t } = useTranslation()
  const ref = useRef<any>(null)

  const [fileNormalInfo, setFileNormalInfo] = useState<FileNormalInfo>(EMPTY_FILE_NORMAL_INFO)

  const curFile = activeId ? getFileObject(activeId) : undefined
  const editorViewType = editorViewTypeMap.get(curFile?.id || '') || 'wysiwyg'

  const { idStateMap } = useEditorStateStore()
  const editorState = activeId ? idStateMap.get(activeId) : undefined

  const getFileNormalInfo = useCallback(
    debounce(async () => {
      if (!curFile?.path) {
        setFileNormalInfo(EMPTY_FILE_NORMAL_INFO)
        return
      }

      try {
        const res = await invoke<FileNormalInfo>('get_file_normal_info', {
          path: curFile.path,
        })

        setFileNormalInfo(res)
      } catch (error: unknown) {
        toast.error((error as Error).message)
      }
    }, 500),
    [curFile],
  )

  useEffect(() => {
    getFileNormalInfo()
  }, [editorState?.hasUnsavedChanges, getFileNormalInfo])

  useEffect(() => {
    const unsubscribe = currentWindow.listen<{
      paths: string[]
    }>('file_watcher_event', async (res) => {
      if (!curFile?.path) {
        return
      }
      if (Array.isArray(res.payload?.paths) && res.payload.paths.includes(curFile.path)) {
        getFileNormalInfo()
      }
    })

    return () => {
      unsubscribe.then((f) => f())
    }
  }, [curFile, getFileNormalInfo])

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

  const handleMenuClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return

    const { getFileTypeConfigById } = useFileTypeConfigStore.getState()
    const curFileTypeConfig = getFileTypeConfigById(curFile?.id || '')
    const { findMark } = useBookMarksStore.getState()
    const curBookMark = findMark(curFile?.path || '')

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items: [
        {
          label: t('view.label'),
          value: 'view_switcher',
          children: [
            {
              label: t('view.source_code'),
              value: EditorViewType.SOURCECODE,
              checked: editorViewType === EditorViewType.SOURCECODE,
              handler: () => bus.emit('editor_toggle_type', EditorViewType.SOURCECODE),
            },
            {
              label: t('view.wysiwyg'),
              value: EditorViewType.WYSIWYG,
              checked: editorViewType === EditorViewType.WYSIWYG,
              handler: () => bus.emit('editor_toggle_type', EditorViewType.WYSIWYG),
            },
            {
              label: t('view.preview'),
              value: EditorViewType.PREVIEW,
              checked: editorViewType === EditorViewType.PREVIEW,
              handler: () => bus.emit('editor_toggle_type', EditorViewType.PREVIEW),
            },
          ].filter((item) => {
            return curFileTypeConfig ? curFileTypeConfig?.supportedModes?.includes(item.value) : false
          }),
        },
        {
          type: 'divider' as const,
        },
        {
          label: t('file.info'),
          value: 'file_info',
          handler: () => {
            NiceModal.show(MODAL_INFO_ID, {
              title: t('file.info'),
              width: '600px',
              content: (
                <Space direction='vertical'>
                  <span>
                    {t('file.lastModified')}: {fileNormalInfo.last_modified}
                  </span>
                  <span>
                    {t('file.size')}: {fileNormalInfo.size}
                  </span>
                  <span>
                    {t('file.path')}: {curFile?.path}
                  </span>
                </Space>
              ),
            })
          },
        },
        {
          type: 'divider' as const,
        },
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
          label: t('action.convert_text'),
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
  }, [curFile, editorViewType, t, execute, convertText, fileNormalInfo])

  if (!curFile) return null

  return (
    <MfIconLabelButton
      iconRef={ref}
      icon={'ri-menu-line'}
      onClick={handleMenuClick}
      tooltipProps={{ title: t('action.more') }}
      label={t('common.menu')}
    />
  )
})
