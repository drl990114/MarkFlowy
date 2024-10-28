import { memo, useCallback, useRef } from 'react'
import { MfIconButton } from '../UI/Button'
import { useCommandStore, useEditorStore } from '@/stores'
import { getFileObject } from '@/helper/files'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { showContextMenu } from '../UI/ContextMenu'
import bus from '@/helper/eventBus'
import { useTranslation } from 'react-i18next'
import useChatGPTStore from '@/extensions/chatgpt/useChatGPTStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { toast } from 'zens'
import useAppTasksStore from '@/stores/useTasksStore'
import NiceModal from '@ebay/nice-modal-react'
import type { InputConfirmModalProps } from '../Modal'
import { MODAL_INPUT_ID } from '../Modal'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'

export const EditorAreaHeader = memo(() => {
  const { activeId, getEditorDelegate, getEditorContent } = useEditorStore()
  const { editorViewTypeMap } = useEditorViewTypeStore()
  const { execute } = useCommandStore()
  const { getPostSummary, getPostTranslate } = useChatGPTStore()
  const { settingData } = useAppSettingStore()
  const { addAppTask } = useAppTasksStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>()
  const ref1 = useRef<HTMLDivElement>()
  const curFile = activeId ? getFileObject(activeId) : undefined

  const fetchCurFileSummary = useCallback(async () => {
    const content = getEditorContent(curFile?.id || '')
    const res = await addAppTask({
      title: 'ChatGPT: Retrieving article abstract',
      promise: getPostSummary(content || '',settingData.extensions_chatgpt_apibase, settingData.extensions_chatgpt_apikey),
    })
    if (res.status === 'done') {
      addNewMarkdownFileEdit({
        fileName: 'summary.md',
        content: `
# Summary

${res.result}
      `,
      })
    } else {
      if (res.status === 'error') toast.error(res.message)
    }
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
      const res = await addAppTask({
        title: 'ChatGPT: Translating article',
        promise: getPostTranslate(content || '',settingData.extensions_chatgpt_apibase,  settingData.extensions_chatgpt_apikey, targetLang),
      })

      if (res.status === 'done') {
        addNewMarkdownFileEdit({
          fileName: `translate-${targetLang}.md`,
          content: `${res.result}`,
        })
      } else {
        if (res.status === 'error') toast.error(res.message)
      }
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
          label: t('settings.extensions.ChatGPT.label'),
          value: 'chatgpt',
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
      ],
    })
  }, [curFile, getEditorDelegate, t, fetchCurFileSummary, execute, fetchCurFileTranslate])

  const handleViewClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return
    const editorViewType = editorViewTypeMap.get(curFile?.id || '') || 'wysiwyg'

    showContextMenu({
      x: rect.x + rect.width,
      y: rect.y + rect.height,
      items: [
        {
          label: t('view.source_code'),
          value: 'sourceCode',
          checked: editorViewType === 'sourceCode',
          handler: () => bus.emit('editor_toggle_type', 'sourceCode'),
        },
        {
          label: t('view.wysiwyg'),
          value: 'wysiwyg',
          checked: editorViewType === 'wysiwyg',
          handler: () => bus.emit('editor_toggle_type', 'wysiwyg'),
        },
        {
          label: t('view.preview'),
          value: 'preview',
          checked: editorViewType === 'preview',
          handler: () => bus.emit('editor_toggle_type', 'preview'),
        },
      ],
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
          <MfIconButton iconRef={ref} icon={viewTypeIconMap[editorViewType]} onClick={handleViewClick} />
          <MfIconButton iconRef={ref1} icon={'ri-more-2-fill'} onClick={handleAddBookMark} />
        </>
      ) : null}
    </div>
  )
})
