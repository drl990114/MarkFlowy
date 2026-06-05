import { getFileObject } from '@/helper/files'
import { dialog } from '@/services/dialog'
import { useEditorStateStore, useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/i18n'
import { Space, toast } from 'zens'
import { MfIconButton } from '../../../../ui-v2/Button'

type FileNormalInfo = {
  size: string
  last_modified: string
}
const EMPTY_FILE_NORMAL_INFO: FileNormalInfo = {
  size: '',
  last_modified: '',
}

export const FileInfo = memo(() => {
  const { activeId } = useEditorStore()
  const { t } = useTranslation()
  const [fileNormalInfo, setFileNormalInfo] = useState<FileNormalInfo>(EMPTY_FILE_NORMAL_INFO)
  const { idStateMap } = useEditorStateStore()
  
  const curFile = activeId ? getFileObject(activeId) : undefined
  const editorState = activeId ? idStateMap.get(activeId) : undefined

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

    return () => {
      getFileNormalInfo.cancel()
    }
  }, [editorState?.hasUnsavedChanges, getFileNormalInfo])

  return (
    <Space>
      <MfIconButton
        size='small'
        rounded='smooth'
        icon='ri-file-info-line'
        onClick={() => {
          dialog.info({
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
                  {t('file.path')}: {curFile?.path}
                </span>
              </Space>
            ),
          })
        }}
      />
    </Space>
  )
})
