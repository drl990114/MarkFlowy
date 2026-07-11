import { getFileObject, getSaveOpenedEditorEntries } from '@/helper/files'
import { dialog } from '@/services/dialog'
import { useEditorStateStore } from '@/stores'
import { t } from '@/i18n'

interface CheckUnsavedFilesParams {
  fileIds: string[]
  onSaveAndClose?: (hasUnsavedFileIds: string[]) => void | Promise<void>
  onUnsavedAndClose?: (hasUnsavedFileIds: string[]) => void | Promise<void>
}

export interface GuardUnsavedFilesParams {
  fileIds: string[]
  onContinue: () => void | Promise<void>
  onSaveAndContinue?: (hasUnsavedFileIds: string[]) => boolean | void | Promise<boolean | void>
  onUnsavedAndContinue?: (hasUnsavedFileIds: string[]) => void | Promise<void>
  labels?: UnsavedConfirmLabels
}

interface UnsavedConfirmLabels {
  save?: string
  unsaved?: string
}

const unique = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)))

export const getUnsavedFileIds = (fileIds: string[]) => {
  const idStateMap = useEditorStateStore.getState().idStateMap

  return unique(fileIds).filter((id) => idStateMap.get(id)?.hasUnsavedChanges)
}

export const saveUnsavedFiles = async (fileIds: string[]) => {
  const saves = unique(fileIds).map((id) => getSaveOpenedEditorEntries(id))
  if (saves.some((saveHandler) => !saveHandler)) return false

  const results = await Promise.all(saves.map((saveHandler) => saveHandler!()))
  return results.every(Boolean)
}

const confirmUnsavedFiles = async (fileIds: string[], labels?: UnsavedConfirmLabels) => {
  return dialog.confirm({
    title: t('confirm.close.title'),
    content: (
      <div>
        {t('confirm.close.description')}
        <div style={{ marginLeft: '1em', marginTop: '0.5em' }}>
          {fileIds.map((id) => (
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
      { id: 'save', label: labels?.save ?? t('action.save_and_close'), primary: true },
      { id: 'unsaved', label: labels?.unsaved ?? t('action.unsave_and_close'), danger: true },
      { id: 'cancel', label: t('common.cancel') },
    ],
  })
}

const guardUnsavedFileIds = async (params: GuardUnsavedFilesParams, hasUnsavedFiles: string[]) => {
  if (hasUnsavedFiles.length === 0) {
    await params.onContinue()
    return true
  }

  const action = await confirmUnsavedFiles(hasUnsavedFiles, params.labels)

  if (action === 'save') {
    if (params.onSaveAndContinue) {
      const saved = await params.onSaveAndContinue(hasUnsavedFiles)
      return saved !== false
    } else {
      const saved = await saveUnsavedFiles(hasUnsavedFiles)
      if (!saved) return false
      await params.onContinue()
    }
    return true
  }

  if (action === 'unsaved') {
    if (params.onUnsavedAndContinue) {
      await params.onUnsavedAndContinue(hasUnsavedFiles)
    } else {
      await params.onContinue()
    }
    return true
  }

  return false
}

export const guardUnsavedFilesAsync = async (params: GuardUnsavedFilesParams) => {
  return guardUnsavedFileIds(params, getUnsavedFileIds(params.fileIds))
}

export const guardUnsavedFiles = (params: GuardUnsavedFilesParams) => {
  const hasUnsavedFiles = getUnsavedFileIds(params.fileIds)

  void guardUnsavedFileIds(params, hasUnsavedFiles)

  return hasUnsavedFiles.length
}

export const checkUnsavedFiles = (params: CheckUnsavedFilesParams) => {
  const hasUnsavedFiles = getUnsavedFileIds(params.fileIds)

  if (hasUnsavedFiles.length > 0) {
    void confirmUnsavedFiles(hasUnsavedFiles).then((action) => {
      if (action === 'save') {
        void params.onSaveAndClose?.(hasUnsavedFiles)
      }
      if (action === 'unsaved') {
        void params.onUnsavedAndClose?.(hasUnsavedFiles)
      }
    })
  }

  return hasUnsavedFiles.length
}
