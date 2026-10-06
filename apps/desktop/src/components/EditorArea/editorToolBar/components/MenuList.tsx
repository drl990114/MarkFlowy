import { commandRegistry } from '@/commands'
import { openLocalHistory } from '@/components/LocalHistory/historyDialogStore'
import { EditorViewType } from '@/constants/editorViewType'
import { showContextMenu } from '@/components/ui-v2/ContextMenu'
import { useBookmarkStore } from '@/extensions/bookmarks/store'
import bus from '@/helper/eventBus'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { isTextfileType } from '@/helper/fileTypeHandler'
import { FileResultCode } from '@/helper/filesys'
import { writeSettingData } from '@/services/app-setting'
import { dialog } from '@/services/dialog'
import { useEditorStateStore, useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { DesktopMenuItemData } from '@/stores/useContextMenuStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import useFileTextDirectionStore, {
  getFileTextDirectionKey,
  type EditorTextDirection,
} from '@/stores/useFileTextDirectionStore'
import { invoke } from '@tauri-apps/api/core'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import {
  ArrowLeftRightIcon,
  BinaryIcon,
  BookmarkIcon,
  EyeIcon,
  FileOutputIcon,
  HistoryIcon,
  InfoIcon,
  LanguagesIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'
import { isDivider, Space, toast } from 'zens'
import { EditorAreaActionButton } from '../../EditorAreaAction'
import { createPdfPrintMenuItem } from '../../pdf-print/pdfPrintMenuItem'
import { createPdfExportMenuItem } from '../../pdf-export/pdfExportMenuItem'
import { createPandocExportMenuItem } from '../../pandoc-export/pandocExportMenuItem'
import { fileSaveCoordinator } from '../../fileSaveCoordinator'
import { TextEncodingDialog } from '../../text-encoding/TextEncodingDialog'

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
  customItems?: DesktopMenuItemData[]
  /** 在标准菜单项之前插入的菜单项 */
  prependItems?: DesktopMenuItemData[]
  /** 在标准菜单项之后插入的菜单项 */
  appendItems?: DesktopMenuItemData[]
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
  const editorPlaceholder = useAppSettingStore((state) => state.settingData.editor_placeholder)
  const { t } = useTranslation()
  const ref = useRef<HTMLButtonElement>(null)

  const [fileNormalInfo, setFileNormalInfo] = useState<FileNormalInfo>(EMPTY_FILE_NORMAL_INFO)
  const [encodingFileId, setEncodingFileId] = useState<string>()

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
      try {
        const content = getEditorContent(targetEditorId || '')
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
        toast.error(error instanceof Error ? error.message : String(error))
      }
    },
    [getEditorContent, targetEditorId],
  )

  const buildMenuItems = useCallback((): DesktopMenuItemData[] => {
    const latestFile = targetEditorId ? getFileObject(targetEditorId) : undefined
    const latestFileName = latestFile?.name || fileName
    const latestFilePath = latestFile?.path || filePath
    const { getFileTypeConfigById } = useFileTypeConfigStore.getState()
    const curFileTypeConfig = getFileTypeConfigById(targetEditorId || '')
    const curBookMark = useBookmarkStore.getState().findBookmark(latestFilePath || '')

    const items: DesktopMenuItemData[] = []

    // 前置自定义项
    if (prependItems?.length) {
      items.push(...prependItems)
      items.push({ type: 'divider' })
    }

    const appendViewItems = () => {
      // 视图切换和显示选项收在同一个子菜单中。
      const viewItems: DesktopMenuItemData[] = []
      if (showViewSwitcher) {
        viewItems.push(
          ...[
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
            return curFileTypeConfig
              ? curFileTypeConfig?.supportedModes?.includes(item.value)
              : false
          }),
        )
      }

      if (viewItems.length > 0) {
        viewItems.push({ type: 'divider' })
      }

      if (showTypewriterScroll) {
        viewItems.push({
          label: t('settings.editor.behavior.typewriter_scroll.label'),
          value: 'typewriter_scroll',
          checked: editorTypewriterScroll,
          handler: () => {
            writeSettingData({ key: 'editor_typewriter_scroll' }, !editorTypewriterScroll)
          },
        })
      }

      viewItems.push({
        label: t('settings.editor.behavior.placeholder.label'),
        value: 'placeholder',
        checked: editorPlaceholder,
        handler: () => {
          writeSettingData({ key: 'editor_placeholder' }, !editorPlaceholder)
        },
      })

      if (showViewSwitcher) {
        items.push({
          label: t('view.label'),
          value: 'view_switcher',
          icon: EyeIcon,
          children: viewItems,
        })
      } else {
        items.push(...viewItems)
      }
    }
    appendViewItems()

    const appendDirectionItem = () => {
      if (latestFile && latestFile.kind !== 'new_tab' && curFileTypeConfig?.type === 'markdown') {
        const key = getFileTextDirectionKey(latestFile.id, latestFile.path)
        const direction = useFileTextDirectionStore.getState().directions[key]
        const selectDirection = (value: EditorTextDirection | undefined) => {
          const file = targetEditorId ? getFileObject(targetEditorId) : undefined
          if (file) useFileTextDirectionStore.getState().setDirection(file, value)
        }
        items.push({
          label: t('settings.editor.behavior.text_direction.label'),
          value: 'text_direction',
          icon: ArrowLeftRightIcon,
          children: [
            {
              label: t('settings.editor.behavior.text_direction.follow_global'),
              value: 'inherit',
              checked: direction === undefined,
              handler: () => selectDirection(undefined),
            },
            { type: 'divider' },
            ...(['auto', 'ltr', 'rtl'] as const).map((value) => ({
              label: t(`settings.editor.behavior.text_direction.${value}`),
              value,
              checked: direction === value,
              handler: () => selectDirection(value),
            })),
          ],
        })
      }
    }
    appendDirectionItem()

    items.push({ type: 'divider' })

    const appendFileItems = () => {
      // 当前文件：信息、编码、历史和收藏保持直接可达。
      if (showFileInfo) {
        items.push({
          label: t('file.info'),
          value: 'file_info',
          icon: InfoIcon,
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
      }

      if (
        targetEditorId &&
        latestFile &&
        latestFile.kind !== 'new_tab' &&
        curFileTypeConfig &&
        isTextfileType(curFileTypeConfig)
      ) {
        const { format } = fileSaveCoordinator.getTextMetadata(targetEditorId)
        const encoding =
          latestFile.path && !fileSaveCoordinator.getDiskRevision(targetEditorId)
            ? ''
            : ` · ${format.encoding.toUpperCase()}${format.bom !== 'none' ? ' BOM' : ''}`
        items.push({
          label: `${t('text_encoding.label')}${encoding}`,
          value: 'text_encoding',
          icon: BinaryIcon,
          handler: () => setEncodingFileId(targetEditorId),
        })
      }

      items.push({
        label: t('history.title'),
        value: 'history',
        icon: HistoryIcon,
        handler: () => openLocalHistory(targetEditorId),
      })

      // 书签
      if (showBookmark) {
        items.push({
          label: t('action.bookmark'),
          value: 'BookMark',
          icon: BookmarkIcon,
          checkedIcon: (
            <BookmarkIcon
              aria-hidden='true'
              className='fill-current text-warning'
              size={14}
              strokeWidth={1.75}
            />
          ),
          checked: curBookMark !== undefined,
          handler: () => {
            if (curBookMark) {
              commandRegistry.execute('edit_bookmark_dialog', curBookMark)
            } else {
              const bookmarkFile = targetEditorId ? getFileObject(targetEditorId) : undefined
              commandRegistry.execute(
                'open_bookmark_dialog',
                bookmarkFile || {
                  id: targetEditorId,
                  name: latestFileName,
                  path: latestFilePath,
                },
              )
            }
          },
        })
      }
    }
    appendFileItems()

    const appendExportItems = () => {
      // 导出与转换
      if (showExport || showConvertText) {
        items.push({ type: 'divider' })
      }

      if (showExport) {
        const exportItems: DesktopMenuItemData[] = [
          {
            value: 'export_html',
            label: t('contextmenu.editor_tab.export_html'),
            handler: () => {
              bus.emit('editor_export_html')
            },
          },
        ]
        if (curFileTypeConfig?.type === 'markdown') {
          exportItems.push(
            createPdfExportMenuItem(t('pdf_export.export')),
            createPdfPrintMenuItem(t('pdf_export.print')),
          )
        }
        exportItems.push({
          value: 'export_image',
          label: t('contextmenu.editor_tab.export_image'),
          handler: () => {
            bus.emit('editor_export_image')
          },
        })
        if (curFileTypeConfig?.type === 'markdown') {
          exportItems.push({ type: 'divider' }, createPandocExportMenuItem(t))
        }
        items.push({
          value: 'export',
          icon: FileOutputIcon,
          label: t('settings.export.label'),
          children: exportItems,
        })
      }

      // 文本转换
      if (showConvertText) {
        items.push({
          label: t('action.convert_text'),
          value: 'convert_text',
          icon: LanguagesIcon,
          children: [
            {
              label: t('action.convert_simplified_to_traditional_tw'),
              value: 'zh-TW',
              handler: () => convertText('zh-TW'),
            },
            {
              label: t('action.convert_simplified_to_traditional_hk'),
              value: 'zh-HK',
              handler: () => convertText('zh-HK'),
            },
            {
              label: t('action.convert_traditional_to_simplified'),
              value: 'zh-Hans',
              handler: () => convertText('zh-Hans'),
            },
          ],
        })
      }
    }
    appendExportItems()

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
    <>
      <EditorAreaActionButton
        aria-haspopup='menu'
        icon={SlidersHorizontalIcon}
        label={t('action.more')}
        onClick={handleMenuClick}
        ref={ref}
      />
      {encodingFileId ? (
        <TextEncodingDialog
          fileId={encodingFileId}
          key={encodingFileId}
          onClose={() => setEncodingFileId(undefined)}
        />
      ) : null}
    </>
  )
})

MenuList.displayName = 'MenuList'
