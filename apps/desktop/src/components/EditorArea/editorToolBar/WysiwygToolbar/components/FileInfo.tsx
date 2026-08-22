import { getFileObject } from '@/helper/files'
import { dialog } from '@/services/dialog'
import { useEditorStateStore, useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { debounce } from 'lodash'
import { FileTextIcon } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/i18n'
import { Space, toast } from 'zens'
import { EditorAreaActionButton } from '../../../EditorAreaAction'

type FileNormalInfo = {
  size: string
  last_modified: string
}
const EMPTY_FILE_NORMAL_INFO: FileNormalInfo = {
  size: '',
  last_modified: '',
}

export const FileInfo = memo(() => {
  const activeId = useEditorStore((state) => state.activeId)
  const { t } = useTranslation()
  const [fileNormalInfo, setFileNormalInfo] = useState<FileNormalInfo>(EMPTY_FILE_NORMAL_INFO)

  const curFile = activeId ? getFileObject(activeId) : undefined
  const hasUnsavedChanges = useEditorStateStore((state) =>
    activeId ? state.idStateMap.get(activeId)?.hasUnsavedChanges : undefined,
  )

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
  }, [hasUnsavedChanges, getFileNormalInfo])

  const showFileInfo = async () => {
    let latestFileNormalInfo = fileNormalInfo

    if (curFile?.path) {
      try {
        latestFileNormalInfo = await invoke<FileNormalInfo>('get_file_normal_info', {
          path: curFile.path,
        })
        setFileNormalInfo(latestFileNormalInfo)
      } catch (error: unknown) {
        toast.error((error as Error).message)
      }
    }

    dialog.info({
      title: t('file.info'),
      width: '600px',
      content: (
        <Space direction='vertical'>
          <span>
            {t('file.lastModified')}: {latestFileNormalInfo.last_modified}
          </span>
          <span>
            {t('file.size')}: {latestFileNormalInfo.size}
          </span>
          <span>
            {t('file.path')}: {curFile?.path}
          </span>
        </Space>
      ),
    })
  }

  return (
    <EditorAreaActionButton
      aria-haspopup='dialog'
      icon={FileTextIcon}
      label={t('file.info')}
      onClick={showFileInfo}
    />
  )
})
