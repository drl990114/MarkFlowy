import { memo, useCallback, useRef } from 'react'
import { MfIconButton } from '../UI/Button'
import { useCommandStore, useEditorStore } from '@/stores'
import { getFileObject } from '@/helper/files'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { showContextMenu } from '../UI/ContextMenu'
import bus from '@/helper/eventBus'
import { useTranslation } from 'react-i18next'
import useAiChatStore from '@/extensions/ai/useAiChatStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useAppTasksStore from '@/stores/useTasksStore'
import NiceModal from '@ebay/nice-modal-react'
import type { InputConfirmModalProps } from '../Modal'
import { MODAL_INPUT_ID } from '../Modal'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { getCurrentAISettingData } from '@/extensions/ai/aiProvidersService'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { EditorViewType } from 'rme'

export const EditorAreaHeader = memo(() => {
  const { activeId, getEditorDelegate, getEditorContent } = useEditorStore()
  const { editorViewTypeMap } = useEditorViewTypeStore()
  const { execute } = useCommandStore()
  const { getPostSummary, getPostTranslate } = useAiChatStore()
  const { settingData } = useAppSettingStore()
  const { addAppTask } = useAppTasksStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>()
  const ref1 = useRef<HTMLDivElement>()
  const curFile = activeId ? getFileObject(activeId) : undefined

  const fetchCurFileSummary = useCallback(async () => {
    const content = getEditorContent(curFile?.id || '')
    const aiSettingData = getCurrentAISettingData()
    const res = await addAppTask<ReturnType<typeof getPostSummary>>({
      title: 'AI: Retrieving article abstract',
      promise: getPostSummary(content || '', aiSettingData.apiBase, aiSettingData.apiKey),
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
          aiSettingData.apiBase,
          aiSettingData.apiKey,
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

  const handleAddBookMark = useCallback(() => {
    const rect = ref1.current?.getBoundingClientRect()
    if (rect === undefined) return
    const { findMark } = useBookMarksStore.getState()
    const curBookMark = findMark(curFile?.path || '')

    const { aiProvider } = useAiChatStore.getState()

    showContextMenu({
      x: rect.x + rect.width,
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
      x: rect.x + rect.width,
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

  return (
    <div className='editor-area-header'>
      {curFile ? (
        <>
          <MfIconButton
            iconRef={ref}
            icon={viewTypeIconMap[editorViewType]}
            onClick={handleViewClick}
          />
          <MfIconButton iconRef={ref1} icon={'ri-more-2-fill'} onClick={handleAddBookMark} />
        </>
      ) : null}
    </div>
  )
})
