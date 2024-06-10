import { isMdFile, type IFile } from '@/helper/filesys'
import { useCallback, type HTMLAttributes, useState, useRef, useEffect } from 'react'
import { Input, Tooltip } from 'zens'
import { unVerifiedFileNameChars, verifyFileName } from './verify-file-name'
import { invoke } from '@tauri-apps/api/core'

const NewFileInput = (
  props: HTMLAttributes<HTMLInputElement> & {
    fileNode: IFile
    inputType?: 'file' | 'dir'
    parentNode?: IFile
    onCreate: (file: IFile) => Promise<void>
    onCancel: () => void
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

  const hideInput = useCallback(() => {
    if (creating.current === true) {
      return
    }
    setInputName('')
    onCancel?.()
  }, [onCancel])

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.addEventListener('blur', hideInput)
      verify(initialName)
    })

    return () => {
      inputRef.current?.removeEventListener('blur', hideInput)
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
    [inputName, fileNode, parentNode, createType],
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
        inputRef={inputRef}
        value={inputName}
        onChange={handleChange}
        spellCheck={false}
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
