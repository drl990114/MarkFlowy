import useAiChatStore, { getCurrentAISettingData } from '@/extensions/ai/useAiChatStore'
import { getFileObject } from '@/helper/files'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { useEditorStore } from '@/stores'
import useAppTasksStore from '@/stores/useTasksStore'
import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { InputConfirmModalProps, MODAL_INPUT_ID } from '../../../../Modal'
import { MfIconButton } from '../../../../ui-v2/Button'
import { showContextMenu } from '../../../../ui-v2/ContextMenu'

export const AIButton = () => {
  const { activeId, getEditorContent } = useEditorStore()
  const { getPostSummary, getPostTranslate, aiProvider } = useAiChatStore()
  const { addAppTask } = useAppTasksStore()
  const { t } = useTranslation()
  const ref = useRef<any>(null)
  
  const curFile = activeId ? getFileObject(activeId) : undefined

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
  ])

  const fetchCurFileTranslate = useCallback(
    async (targetLang: string) => {
      const content = getEditorContent(curFile?.id || '')
      const aiSettingData = getCurrentAISettingData()

      const res = await addAppTask({
        title: 'AI: Translating article',
        promise: getPostTranslate(content || '', aiSettingData, targetLang),
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
    ],
  )

  const handleAIClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items: [
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
    })
  }, [t, fetchCurFileSummary, fetchCurFileTranslate])

  if (!curFile) return null

  return (
    <MfIconButton
      size='small'
      rounded='smooth'
      iconRef={ref}
      icon={'ri-quill-pen-ai-line'}
      onClick={handleAIClick}
      tooltipProps={{ title: `AI (${aiProvider})` }}
    />
  )
}
