import { commandRegistry } from '@/commands'
import { MODAL_INFO_ID } from '@/components/Modal'
import { MfIconLabelButton } from '@/components/ui-v2/Button/icon-label-button'
import { showContextMenu } from '@/components/ui-v2/ContextMenu'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import bus from '@/helper/eventBus'
import { getFileObject } from '@/helper/files'
import { FileResultCode } from '@/helper/filesys'
import { writeSettingData } from '@/services/app-setting'
import { currentWindow } from '@/services/windows'
import { useEditorStateStore, useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import NiceModal from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { EditorViewType } from 'rme'
import { isDivider, Space, toast, type MenuItemData } from 'zens'

type FileNormalInfo = {
  size: string
  last_modified: string
}

const EMPTY_FILE_NORMAL_INFO: FileNormalInfo = {
  size: '',
  last_modified: '',
}

export interface MenuListProps {
  /** 是否显示视图切换选项 */
  showViewSwitcher?: boolean
  /** 是否显示打字机滚动选项 */
  showTypewriterScroll?: boolean
  /** 是否显示文件信息 */
  showFileInfo?: boolean
  /** 是否显示书签 */
  showBookmark?: boolean
  /** 是否显示导出选项 */
  showExport?: boolean
  /** 是否显示文本转换 */
  showConvertText?: boolean
  /** 自定义菜单项 */
  customItems?: MenuItemData[]
  /** 在标准菜单项之前插入的菜单项 */
  prependItems?: MenuItemData[]
  /** 在标准菜单项之后插入的菜单项 */
  appendItems?: MenuItemData[]
  /** 按钮大小 */
  size?: 'small' | 'medium' | 'large'
  /** 按钮圆角 */
  rounded?: 'smooth' | 'rounded' | 'square'
}

export const MenuList = memo((props: MenuListProps) => {
  const {
    showViewSwitcher = true,
    showTypewriterScroll = false,
    showFileInfo = true,
    showBookmark = true,
    showExport = true,
    showConvertText = true,
    customItems,
    prependItems,
    appendItems,
    size,
    rounded,
  } = props

  const { activeId, getEditorContent } = useEditorStore()
  const { editorViewTypeMap } = useEditorViewTypeStore()
  const { settingData } = useAppSettingStore()
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

  const buildMenuItems = useCallback((): MenuItemData[] => {
    const { getFileTypeConfigById } = useFileTypeConfigStore.getState()
    const curFileTypeConfig = getFileTypeConfigById(curFile?.id || '')
    const { findMark } = useBookMarksStore.getState()
    const curBookMark = findMark(curFile?.path || '')

    const items: MenuItemData[] = []

    // 前置自定义项
    if (prependItems?.length) {
      items.push(...prependItems)
      items.push({ type: 'divider' })
    }

    // 视图切换
    if (showViewSwitcher) {
      items.push({
        label: t('view.label'),
        value: 'view_switcher',
        children: [
          {
            label: t('view.source_code'),
            value: EditorViewType.SOURCECODE,
            checked: editorViewType === EditorViewType.SOURCECODE,
            commandId: 'app_toggleEditorType',
            handler: () => bus.emit('editor_toggle_type', EditorViewType.SOURCECODE),
          },
          {
            label: t('view.wysiwyg'),
            value: EditorViewType.WYSIWYG,
            checked: editorViewType === EditorViewType.WYSIWYG,
            commandId: 'app_toggleEditorType',
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
      })
      items.push({ type: 'divider' })
    }

    // 打字机滚动
    if (showTypewriterScroll) {
      items.push({
        label: t('settings.editor.behavior.typewriter_scroll.label'),
        value: 'typewriter_scroll',
        checked: settingData.editor_typewriter_scroll,
        handler: () => {
          writeSettingData(
            { key: 'editor_typewriter_scroll' },
            !settingData.editor_typewriter_scroll,
          )
        },
      })
      items.push({ type: 'divider' })
    }

    // 文件信息
    if (showFileInfo) {
      items.push({
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
      })
      items.push({ type: 'divider' })
    }

    // 书签
    if (showBookmark) {
      items.push({
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
      })
      items.push({ type: 'divider' })
    }

    // 导出
    if (showExport) {
      items.push({
        value: 'export_html',
        label: t('contextmenu.editor_tab.export_html'),
        handler: () => {
          bus.emit('editor_export_html')
        },
      })
      items.push({
        value: 'export_image',
        label: t('contextmenu.editor_tab.export_image'),
        handler: () => {
          bus.emit('editor_export_image')
        },
      })
      items.push({ type: 'divider' })
    }

    // 文本转换
    if (showConvertText) {
      items.push({
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
      })
    }

    // 后置自定义项
    if (appendItems?.length) {
      if (items.length > 0 && !isDivider(items[items.length - 1])) {
        items.push({ type: 'divider' })
      }
      items.push(...appendItems)
    }

    // 移除末尾的分隔符
    while (items.length > 0 && isDivider(items[items.length - 1])) {
      items.pop()
    }

    return customItems || items
  }, [
    curFile,
    editorViewType,
    fileNormalInfo,
    settingData.editor_typewriter_scroll,
    t,
    convertText,
    showViewSwitcher,
    showTypewriterScroll,
    showFileInfo,
    showBookmark,
    showExport,
    showConvertText,
    customItems,
    prependItems,
    appendItems,
  ])

  const handleMenuClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items: buildMenuItems(),
    })
  }, [buildMenuItems])

  if (!curFile) return null

  return (
    <MfIconLabelButton
      iconRef={ref}
      icon={'ri-menu-line'}
      onClick={handleMenuClick}
      tooltipProps={{ title: t('action.more') }}
      label={t('common.menu')}
      size={size}
      rounded={rounded}
    />
  )
})

MenuList.displayName = 'MenuList'
