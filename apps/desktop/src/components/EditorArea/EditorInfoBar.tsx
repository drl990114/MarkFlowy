
import useAiChatStore, { getCurrentAISettingData } from '@/extensions/ai/useAiChatStore'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import bus from '@/helper/eventBus'
import { getFileObject } from '@/helper/files'
import { getRelativePathWithCurWorkspace } from '@/helper/filesys'
import { addNewMarkdownFileEdit, isEmptyEditor } from '@/services/editor-file'
import { gitAddFileWithCurrentWorkspace } from '@/services/git'
import { currentWindow } from '@/services/windows'
import { checkIsGitRepoBySyncMode, getWorkspace, WorkSpace } from '@/services/workspace'
import { useCommandStore, useEditorStateStore, useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import useAppTasksStore from '@/stores/useTasksStore'
import NiceModal from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import { Command } from '@tauri-apps/plugin-shell'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorViewType } from 'rme'
import styled from 'styled-components'
import { Space, toast } from 'zens'
import { InputConfirmModalProps, MODAL_INFO_ID, MODAL_INPUT_ID } from '../Modal'
import { MfIconButton } from '../UI/Button'
import { showContextMenu } from '../UI/ContextMenu'

type FileNormalInfo = {
  size: string
  last_modified: string
}
const EMPTY_FILE_NORMAL_INFO: FileNormalInfo = {
  size: '',
  last_modified: '',
}

export const EditorInfoBar = memo(() => {
  const { activeId, folderData, getEditorDelegate, getEditorContent, getRootPath } =
    useEditorStore()
  const [workspace, setWorkspace] = useState<WorkSpace | null>(null)

  const { editorViewTypeMap } = useEditorViewTypeStore()
  const { execute } = useCommandStore()
  const { getPostSummary, getPostTranslate } = useAiChatStore()
  const { settingData } = useAppSettingStore()
  const { addAppTask } = useAppTasksStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  const curFile = activeId ? getFileObject(activeId) : undefined
  const [hasGitStatus, setHasGitStatus] = useState(false)
  const [fileNormalInfo, setFileNormalInfo] = useState<FileNormalInfo>(EMPTY_FILE_NORMAL_INFO)
  const { idStateMap } = useEditorStateStore()
  const editorState = activeId ? idStateMap.get(activeId) : undefined
  const rootPath = getRootPath()

  useEffect(() => {
    getWorkspace().then((workspace) => {
      setWorkspace(workspace)
    })
  }, [folderData])

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

  const checkCurFileGitStatus = useCallback(async () => {
    if (!curFile?.path || !rootPath) {
      setHasGitStatus(false)
      return
    }

    // check current file status
    try {
      const res = await Command.create(
        'run-git-diff',
        ['diff', '--name-only', getRelativePathWithCurWorkspace(curFile?.path)],
        {
          cwd: rootPath,
        },
      ).execute()

      if (res.stdout.trim()) {
        setHasGitStatus(true)
      } else {
        setHasGitStatus(false)
      }
    } catch (error) {
      console.error('Failed to check git status:', error)
      setHasGitStatus(false)
    }
  }, [curFile?.path, rootPath])

  useEffect(() => {
    checkCurFileGitStatus()

    const unsubscribe = currentWindow.listen<{
      paths: string[]
    }>('file_watcher_event', async (res) => {
      if (!curFile?.path) {
        return
      }
      if (Array.isArray(res.payload?.paths) && res.payload.paths.includes(curFile.path)) {
        getFileNormalInfo()
      }

      if (checkIsGitRepoBySyncMode(workspace?.syncMode)) {
        checkCurFileGitStatus()
      }
    })

    return () => {
      unsubscribe.then((f) => f())
    }
  }, [workspace?.syncMode, checkCurFileGitStatus, getFileNormalInfo])

  const fetchCurFileSummary = useCallback(async () => {
    const content = getEditorContent(curFile?.id || '')
    const aiSettingData = getCurrentAISettingData()
    const res = await addAppTask<ReturnType<typeof getPostSummary>>({
      title: 'AI: Retrieving article abstract',
      promise: getPostSummary(content || '', aiSettingData),
    })
    addNewMarkdownFileEdit({
      fileName: 'summary.md',
      content: `
# Summary

${res}
    `,
    })
  }, [
    addAppTask,
    curFile?.id,
    getEditorContent,
    getPostSummary,
    settingData.extensions_chatgpt_apikey,
  ])

  const fetchCurFileTranslate = useCallback(
    async (targetLang: string) => {
      const content = getEditorContent(curFile?.id || '')
      const aiSettingData = getCurrentAISettingData()

      const res = await addAppTask({
        title: 'AI: Translating article',
        promise: getPostTranslate(
          content || '',
          aiSettingData,
          targetLang,
        ),
      })

      addNewMarkdownFileEdit({
        fileName: `translate-${targetLang}.md`,
        content: `${res}`,
      })
    },
    [
      addAppTask,
      curFile?.id,
      getEditorContent,
      getPostTranslate,
      settingData.extensions_chatgpt_apikey,
    ],
  )

  const handleMoreAction = useCallback(() => {
    const rect = ref1.current?.getBoundingClientRect()
    if (rect === undefined) return
    const { findMark } = useBookMarksStore.getState()
    const curBookMark = findMark(curFile?.path || '')

    const { aiProvider } = useAiChatStore.getState()

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
          label: `AI(${aiProvider})`,
          value: 'AI',
          children: [
            {
              label: t('action.summary'),
              value: 'summary',
              handler: fetchCurFileSummary,
            },
            {
              label: t('action.translate'),
              value: 'translate',
              handler: () => {
                NiceModal.show<any, InputConfirmModalProps>(MODAL_INPUT_ID, {
                  title: t('action.translate'),
                  inputProps: {
                    placeholder: t('placeholder.translate'),
                  },
                  onConfirm: (val) => {
                    if (!val) {
                      return
                    }
                    fetchCurFileTranslate(val)
                  },
                })
              },
            },
          ],
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
      ],
    })
  }, [curFile, getEditorDelegate, t, fetchCurFileSummary, execute, fetchCurFileTranslate])

  const handleViewClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return
    const editorViewType = editorViewTypeMap.get(curFile?.id || '') || 'wysiwyg'
    const { getFileTypeConfigById } = useFileTypeConfigStore.getState()
    const curFileTypeConfig = getFileTypeConfigById(curFile?.id || '')

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items: [
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
    })
  }, [curFile, editorViewTypeMap, t, fetchCurFileSummary, execute, fetchCurFileTranslate])

  const editorViewType = editorViewTypeMap.get(curFile?.id || '') || 'wysiwyg'

  const viewTypeIconMap = {
    sourceCode: 'ri-code-s-slash-line',
    wysiwyg: 'ri-edit-2-line',
    preview: 'ri-eye-line',
  }

  if (!activeId || !curFile || isEmptyEditor(curFile.id)) return null

  return (
    <Container>
      {fileNormalInfo.last_modified ? (
        <Space>
          <span>
            {t('file.lastModified')}: {fileNormalInfo.last_modified}
          </span>
          <MfIconButton
            size='small'
            rounded='smooth'
            icon='ri-file-info-line'
            onClick={() => {
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
                      {t('file.path')}: {curFile.path}
                    </span>
                  </Space>
                ),
              })
            }}
          />
        </Space>
      ) : (
        <div />
      )}

      <Space>
        {checkIsGitRepoBySyncMode(workspace?.syncMode) && hasGitStatus ? (
          <MfIconButton
            size='small'
            rounded='smooth'
            iconRef={ref2}
            icon='ri-git-repository-commits-line'
            onClick={() => {
              if (!curFile.path) return

              const rect = ref2.current?.getBoundingClientRect()
              if (rect === undefined) return

              showContextMenu({
                x: rect.x,
                y: rect.y + rect.height,
                items: [
                  {
                    label: 'git add',
                    value: 'git_add',
                    handler: () => gitAddFileWithCurrentWorkspace(curFile),
                  },
                ],
              })
            }}
          />
        ) : null}
        <MfIconButton
          size='small'
          rounded='smooth'
          iconRef={ref}
          icon={viewTypeIconMap[editorViewType]}
          onClick={handleViewClick}
        />
        <MfIconButton
          size='small'
          rounded='smooth'
          iconRef={ref1}
          icon={'ri-more-fill'}
          onClick={handleMoreAction}
        />
      </Space>
    </Container>
  )
})

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: ${(props) => props.theme.fontXs};
`
