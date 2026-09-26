import useFileCacheStore from '@/helper/files'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { useTranslation } from '@/i18n'

export function DocumentTitle() {
  const id = useEditorStore((state) => state.activeId)
  const file = useFileCacheStore((state) => (id ? state.entries[id] : undefined))
  const dirty = useEditorStateStore((state) =>
    Boolean(id && state.idStateMap.get(id)?.hasUnsavedChanges),
  )
  const { t } = useTranslation()
  return (
    <span
      className='flex min-w-0 items-center gap-1 text-ui-control font-medium text-content-primary'
      data-tauri-drag-region
      title={file?.path}
    >
      <span className='truncate' data-tauri-drag-region>
        {!file?.path && file?.name === `${t('file.untitled')}.md`
          ? t('file.untitled')
          : (file?.name ?? t('file.untitled'))}
      </span>
      <span className='w-2 shrink-0 text-ui-caption' data-tauri-drag-region>
        {dirty ? '•' : null}
      </span>
    </span>
  )
}
