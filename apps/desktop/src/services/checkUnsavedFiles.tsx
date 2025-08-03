import { MODAL_CONFIRM_ID } from '@/components/Modal'
import { getFileObject } from '@/helper/files'
import { useEditorStateStore } from '@/stores'
import NiceModal from '@ebay/nice-modal-react'
import { t } from 'i18next'
import { Button } from 'zens'

interface CheckUnsavedFilesParams {
  fileIds: string[]
  onSaveAndClose?: (hasUnsavedFileIds: string[]) => void
  onUnsavedAndClose?: () => void
}
export const checkUnsavedFiles = (params: CheckUnsavedFilesParams) => {
  const idStateMap = useEditorStateStore.getState().idStateMap

  const hasUnsavedFiles = params.fileIds.filter((id) => idStateMap.get(id)?.hasUnsavedChanges)
  if (hasUnsavedFiles.length > 0) {
    NiceModal.show(MODAL_CONFIRM_ID, {
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
      actionsGenerater: (hideModal: () => void) => [
        <Button
          key='confirm'
          btnType='primary'
          onClick={() => {
            params.onSaveAndClose?.(hasUnsavedFiles)
            hideModal()
          }}
        >
          {t('action.save_and_close')}
        </Button>,
        <Button
          key='unsaved'
          onClick={() => {
            params.onUnsavedAndClose?.()
            hideModal()
          }}
        >
          {t('action.unsave_and_close')}
        </Button>,
        <Button key='cancel' onClick={hideModal}>
          {t('common.cancel')}
        </Button>,
      ],
    })
  }

  return hasUnsavedFiles.length
}
