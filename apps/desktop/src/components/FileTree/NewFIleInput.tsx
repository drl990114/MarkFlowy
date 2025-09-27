import { isMdFile, type IFile } from '@/helper/filesys'
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { Input, Tooltip } from 'zens'
import { unVerifiedFileNameChars, verifyFileName } from './verify-file-name'

const NewFileInput = (
  props: HTMLAttributes<HTMLInputElement> & {
    fileNode: IFile
    inputType?: 'file' | 'dir'
    parentNode?: IFile
    onCreate: (file: IFile) => Promise<void>
    /**
     * @param file 如果创建的文件名无效，则为 undefined
     * @returns
     */
    onCancel: (file?: IFile) => void
  },
) => {
  const {
    className,
    fileNode,
    parentNode,
    inputType: createType = 'file',
    onCreate,
    onCancel,
    ...otherProps
  } = props

  const InvalidTextMap = {
    same: createType === 'file' ? 'has same file' : 'has same folder',
    empty: 'file name can not be empty',
    invalid: `file name can not include ${unVerifiedFileNameChars.join(' ')}`,
  }

  const initialName = fileNode.name || ''
  const [inputName, setInputName] = useState(initialName)
  const [invalidState, setInvalidState] = useState(false)
  const [invalidText, setInvalidText] = useState(InvalidTextMap.same)
  const verifing = useRef(false)
  const creating = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleBlur = useCallback(() => {
    if (creating.current === true) {
      return
    }
    const fileName = inputRef.current?.value || initialName
    if (invalidState === false && verifing.current === false && fileName) {
      getFileInfo(fileName)
        .then((fileInfo) => {
          onCancel?.(fileInfo)
        })
        .catch(() => {
          onCancel?.()
        })
    } else {
      onCancel?.()
    }
  }, [onCancel])

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.addEventListener('blur', handleBlur)
      verify(initialName)
    })

    return () => {
      inputRef.current?.removeEventListener('blur', handleBlur)
    }
  }, [initialName])

  const getFileInfo = useCallback(
    async (fileName: string): Promise<IFile> => {
      let path1 = parentNode?.path

      if (createType === 'file' && !isMdFile(fileName)) {
        fileName = `${fileName}.md`
      }

      const targetPath = await invoke<string>('path_join', { path1, path2: fileName })

      return {
        id: fileNode.id,
        kind: createType,
        path: targetPath,
        name: fileName,
      }
    },
    [fileNode, parentNode, createType],
  )

  const verify = useCallback(
    async (name: string) => {
      verifing.current = true

      try {
        const fileName = name
        if (fileName === '') {
          setInvalidText(InvalidTextMap.empty)
          setInvalidState(true)
        } else if (verifyFileName(fileName) === false) {
          setInvalidText(InvalidTextMap.invalid)
          setInvalidState(true)
        } else {
          const { path } = await getFileInfo(fileName)

          const fileExists = await invoke('file_exists', { filePath: path })

          if (fileExists) {
            setInvalidText(InvalidTextMap.same)
            setInvalidState(true)
          } else {
            setInvalidState(false)
          }
        }
      } catch (error) {}

      verifing.current = false
    },
    [getFileInfo],
  )

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    async (e) => {
      e.stopPropagation()
      let fileName = e.target.value
      setInputName(fileName)

      verify(fileName)
    },
    [verify],
  )

  return (
    <Tooltip title={invalidText} open={invalidState}>
      <Input
        size='small'
        inputRef={inputRef}
        value={inputName}
        onChange={handleChange}
        spellCheck={false}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onPressEnter={async () => {
          if (invalidState === false && verifing.current === false) {
            const fileInfo = await getFileInfo(inputName)
            creating.current = true
            onCreate(fileInfo).finally(() => {
              creating.current = false
            })
          }
        }}
        {...otherProps}
      ></Input>
    </Tooltip>
  )
}

export default NewFileInput
