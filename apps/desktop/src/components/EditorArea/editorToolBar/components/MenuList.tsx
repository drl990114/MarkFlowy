import { commandRegistry } from '@/commands'
import { showContextMenu } from '@/components/ui-v2/ContextMenu'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import bus from '@/helper/eventBus'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { FileResultCode } from '@/helper/filesys'
import { writeSettingData } from '@/services/app-setting'
import { dialog } from '@/services/dialog'
import { useEditorStateStore, useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { invoke } from '@tauri-apps/api/core'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { MenuIcon } from 'lucide-react'
import { EditorViewType } from 'rme'
import { isDivider, Space, toast, type MenuItemData } from 'zens'
import { EditorAreaActionButton } from '../../EditorAreaAction'
import { createPdfPrintMenuItem } from '../../pdf-print/pdfPrintMenuItem'

type FileNormalInfo = {
  size: string
  last_modified: string
}

const EMPTY_FILE_NORMAL_INFO: FileNormalInfo = {
  size: '',
  last_modified: '',
}

export interface MenuListProps {
  /** 目标 editor，默认使用当前全局 active editor */
  editorId?: string
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
}

export const MenuList = memo((props: MenuListProps) => {
  const {
    editorId,
    showViewSwitcher = true,
    showTypewriterScroll = false,
    showFileInfo = true,
    showBookmark = true,
    showExport = true,
    showConvertText = true,
    customItems,
    prependItems,
    appendItems,
  } = props

  const activeId = useEditorStore((state) => state.activeId)
  const getEditorContent = useEditorStore((state) => state.getEditorContent)
  const targetEditorId = editorId ?? activeId
  const fileName = useFileCacheStore((state) =>
    targetEditorId ? state.entries[targetEditorId]?.name : undefined,
  )
  const filePath = useFileCacheStore((state) =>
    targetEditorId ? state.entries[targetEditorId]?.path : undefined,
  )
  const editorViewType = useEditorViewTypeStore((state) =>
    targetEditorId ? state.editorViewTypeMap.get(targetEditorId) || 'wysiwyg' : 'wysiwyg',
  )
  const editorTypewriterScroll = useAppSettingStore(
    (state) => state.settingData.editor_typewriter_scroll,
  )
  const editorPlaceholder = useAppSettingStore(
    (state) => state.settingData.editor_placeholder,
  )
  const { t } = useTranslation()
  const ref = useRef<HTMLButtonElement>(null)

  const [fileNormalInfo, setFileNormalInfo] = useState<FileNormalInfo>(EMPTY_FILE_NORMAL_INFO)

  const hasUnsavedChanges = useEditorStateStore((state) =>
    targetEditorId ? state.idStateMap.get(targetEditorId)?.hasUnsavedChanges : undefined,
  )

  const getFileNormalInfo = useCallback(
    debounce(async () => {
      if (!filePath) {
        setFileNormalInfo(EMPTY_FILE_NORMAL_INFO)
        return
      }

      try {
        const res = await invoke<FileNormalInfo>('get_file_normal_info', {
          path: filePath,
        })

        setFileNormalInfo(res)
      } catch (error: unknown) {
        toast.error((error as Error).message)
      }
    }, 500),
    [filePath],
  )

  useEffect(() => {
    getFileNormalInfo()

    return () => {
      getFileNormalInfo.cancel()
    }
  }, [hasUnsavedChanges, getFileNormalInfo])

  const convertText = useCallback(
    async (variant: string) => {
      const content = getEditorContent(targetEditorId || '')
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
    [getEditorContent, targetEditorId],
  )

  const buildMenuItems = useCallback((): MenuItemData[] => {
    const latestFile = targetEditorId ? getFileObject(targetEditorId) : undefined
    const latestFileName = latestFile?.name || fileName
    const latestFilePath = latestFile?.path || filePath
    const { getFileTypeConfigById } = useFileTypeConfigStore.getState()
    const curFileTypeConfig = getFileTypeConfigById(targetEditorId || '')
    const { findMark } = useBookMarksStore.getState()
    const curBookMark = findMark(latestFilePath || '')

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
            handler: () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE),
          },
          {
            label: t('view.wysiwyg'),
            value: EditorViewType.WYSIWYG,
            checked: editorViewType === EditorViewType.WYSIWYG,
            commandId: 'app_toggleEditorType',
            handler: () => bus.emit('editor_toggle_type', undefined, EditorViewType.WYSIWYG),
          },
          {
            label: t('view.preview'),
            value: EditorViewType.PREVIEW,
            checked: editorViewType === EditorViewType.PREVIEW,
            handler: () => bus.emit('editor_toggle_type', undefined, EditorViewType.PREVIEW),
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
        checked: editorTypewriterScroll,
        handler: () => {
          writeSettingData(
            { key: 'editor_typewriter_scroll' },
            !editorTypewriterScroll,
          )
        },
      })
      items.push({ type: 'divider' })
    }

    // 占位符提示
    items.push({
      label: t('settings.editor.behavior.placeholder.label'),
      value: 'placeholder',
      checked: editorPlaceholder,
      handler: () => {
        writeSettingData(
          { key: 'editor_placeholder' },
          !editorPlaceholder,
        )
      },
    })
    items.push({ type: 'divider' })

    // 文件信息
    if (showFileInfo) {
      items.push({
        label: t('file.info'),
        value: 'file_info',
        handler: async () => {
          let latestFileNormalInfo = fileNormalInfo
          const infoFilePath = targetEditorId
            ? getFileObject(targetEditorId)?.path
            : latestFilePath

          if (infoFilePath) {
            try {
              latestFileNormalInfo = await invoke<FileNormalInfo>('get_file_normal_info', {
                path: infoFilePath,
              })
              setFileNormalInfo(latestFileNormalInfo)
            } catch (error: unknown) {
              toast.error((error as Error).message)
            }
          }

          dialog.info({
            title: t('file.info'),
            width: '600px',
            content: (
              <Space direction='vertical'>
                <span>
                  {t('file.lastModified')}: {latestFileNormalInfo.last_modified}
                </span>
                <span>
                  {t('file.size')}: {latestFileNormalInfo.size}
                </span>
                <span>
                  {t('file.path')}: {infoFilePath}
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
            const bookmarkFile = targetEditorId ? getFileObject(targetEditorId) : undefined
            commandRegistry.execute('open_bookmark_dialog', bookmarkFile || {
              id: targetEditorId,
              name: latestFileName,
              path: latestFilePath,
            })
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
      if (curFileTypeConfig?.type === 'markdown') {
        items.push(createPdfPrintMenuItem(t('contextmenu.editor_tab.export_pdf')))
      }
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
    targetEditorId,
    fileName,
    filePath,
    editorViewType,
    fileNormalInfo,
    editorTypewriterScroll,
    editorPlaceholder,
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

  if (!targetEditorId || !fileName) return null

  return (
    <EditorAreaActionButton
      aria-haspopup='menu'
      icon={MenuIcon}
      label={t('action.more')}
      onClick={handleMenuClick}
      ref={ref}
    />
  )
})

MenuList.displayName = 'MenuList'
