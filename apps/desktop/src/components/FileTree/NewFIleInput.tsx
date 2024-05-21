import { isMdFile, type IFile } from '@/helper/filesys'
import { useCallback, type HTMLAttributes, useState, useRef, useEffect } from 'react'
import { Input, Tooltip } from 'zens'
import { unVerifiedFileNameChars, verifyFileName } from './verify-file-name'
import { invoke } from '@tauri-apps/api/core'

const InvalidTextMap = {
  same: 'has same file',
  empty: 'file name can not be empty',
  invalid: `file name can not include ${unVerifiedFileNameChars.join(' ')}`,
}

const NewFileInput = (
  props: HTMLAttributes<HTMLInputElement> & {
    fileNode: IFile
    parentNode?: IFile
    onCreate: (file: IFile) => void
    onCancel: () => void
  },
) => {
  const { className, fileNode, parentNode, onCreate, onCancel, ...otherProps } = props
  const [inputName, setInputName] = useState('')
  const [invalidState, setInvalidState] = useState(false)
  const [invalidText, setInvalidText] = useState(InvalidTextMap.same)
  const verifing = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hideInput = useCallback(() => {
    setInputName('')
    onCancel?.()
  }, [onCancel])

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.addEventListener('blur', hideInput)
      verify('')
    })

    return () => {
      inputRef.current?.removeEventListener('blur', hideInput)
    }
  }, [])

  const getFileInfo = useCallback(
    async (fileName: string): Promise<IFile> => {
      let path1 = parentNode?.path

      if (!isMdFile(fileName)) {
        fileName = `${fileName}.md`
      }
      console.log('parentNode', parentNode, path1)

      const targetPath = await invoke<string>('path_join', { path1, path2: fileName })

      return {
        id: fileNode.id,
        kind: 'file',
        path: targetPath,
        name: fileName,
      }
    },
    [inputName, fileNode, parentNode],
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

            onCreate(fileInfo)
          }
        }}
        {...otherProps}
      ></Input>
    </Tooltip>
  )
}

export default NewFileInput
