import { getFileObject } from '@/helper/files'
import { dialog } from '@/services/dialog'
import { useEditorStateStore } from '@/stores'
import { t } from '@/i18n'

interface CheckUnsavedFilesParams {
  fileIds: string[]
  onSaveAndClose?: (hasUnsavedFileIds: string[]) => void
  onUnsavedAndClose?: () => void
}
export const checkUnsavedFiles = (params: CheckUnsavedFilesParams) => {
  const idStateMap = useEditorStateStore.getState().idStateMap

  const hasUnsavedFiles = params.fileIds.filter((id) => idStateMap.get(id)?.hasUnsavedChanges)
  if (hasUnsavedFiles.length > 0) {
    dialog.confirm({
      title: t('confirm.close.title'),
      content: (
        <div>
          {t('confirm.close.description')}
          <div style={{ marginLeft: '1em', marginTop: '0.5em' }}>
            {hasUnsavedFiles.map((id) => (
              <div
                key={id}
                style={{
                  fontSize: '0.85em',
                  marginBottom: '0.5em',
                }}
              >
                {getFileObject(id)?.name}
              </div>
            ))}
          </div>
        </div>
      ),
      actions: [
        { id: 'save', label: t('action.save_and_close'), primary: true },
        { id: 'unsaved', label: t('action.unsave_and_close'), danger: true },
        { id: 'cancel', label: t('common.cancel') },
      ],
    }).then((action) => {
      if (action === 'save') {
        params.onSaveAndClose?.(hasUnsavedFiles)
      }
      if (action === 'unsaved') {
        params.onUnsavedAndClose?.()
      }
    })
  }

  return hasUnsavedFiles.length
}
