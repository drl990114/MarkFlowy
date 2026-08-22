import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getCurrentAIProviderDisplayName,
  summarizeAIText,
  translateAIText,
} from '@/extensions/ai/aiTextActions'
import { useAIModelPreference } from '@/extensions/ai/aiModelPreference'
import { getFileObject } from '@/helper/files'
import { dialog } from '@/services/dialog'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { useEditorStore } from '@/stores'
import useAppTasksStore from '@/stores/useTasksStore'
import { SparklesIcon } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from '@/i18n'
import { showContextMenu } from '../../../../ui-v2/ContextMenu'

interface AIButtonProps {
  editorId?: string
}

export const AIButton = (props: AIButtonProps) => {
  const { editorId } = props
  const activeId = useEditorStore((state) => state.activeId)
  const getEditorContent = useEditorStore((state) => state.getEditorContent)
  const targetEditorId = editorId ?? activeId
  useAIModelPreference((state) => state.selectedModelKey)
  const aiProvider = getCurrentAIProviderDisplayName()
  const { addAppTask } = useAppTasksStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLButtonElement>(null)

  const curFile = targetEditorId ? getFileObject(targetEditorId) : undefined

  const fetchCurFileSummary = useCallback(async () => {
    const content = getEditorContent(curFile?.id || '')
    const res = await addAppTask<ReturnType<typeof summarizeAIText>>({
      title: 'AI: Retrieving article abstract',
      promise: summarizeAIText(content || ''),
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
  ])

  const fetchCurFileTranslate = useCallback(
    async (targetLang: string) => {
      const content = getEditorContent(curFile?.id || '')
      const res = await addAppTask({
        title: 'AI: Translating article',
        promise: translateAIText(content || '', targetLang),
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
          handler: async () => {
            const val = await dialog.inputConfirm({
              title: t('action.translate'),
              inputProps: {
                placeholder: t('placeholder.translate'),
              },
            })

            if (val) {
              fetchCurFileTranslate(val)
            }
          },
        },
      ],
    })
  }, [t, fetchCurFileSummary, fetchCurFileTranslate])

  if (!curFile) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-haspopup='menu'
          aria-label={`AI (${aiProvider})`}
          className='h-[22px] gap-1 rounded-sm px-1.5 text-xs font-normal [&_svg]:size-3.5'
          onClick={handleAIClick}
          ref={ref}
          size='sm'
          variant='chrome'
        >
          <SparklesIcon aria-hidden='true' size={14} strokeWidth={1.75} />
          <span>AI</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{`AI (${aiProvider})`}</TooltipContent>
    </Tooltip>
  )
}
