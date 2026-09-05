import React, { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { Input, Tooltip } from 'zens'
import type { IFile } from '../../types/file'
import { useFileSystem } from '../../contexts/FileSystemContext'
import { isMdFile, unVerifiedFileNameChars, verifyFileName } from './verify-file-name'
import { hasRenameConflict } from './rename-conflict'

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
    fileNode,
    parentNode,
    inputType: createType = 'file',
    onCreate,
    onCancel,
    ...otherProps
  } = props

  const { pathJoin, fileExists, pathsReferToSameDirectoryEntry } = useFileSystem()

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
  const validationVersion = useRef(0)
  const creating = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isComposing = useRef(false)

  const handleBlur = () => {
    if (creating.current === true) {
      return
    }
    if (isComposing.current) {
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
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
    })
    return () => clearTimeout(timer)
  }, [initialName])

  const getFileInfo = useCallback(
    async (fileName: string): Promise<IFile> => {
      const path1 = parentNode?.path

      if (createType === 'file' && !isMdFile(fileName)) {
        fileName = `${fileName}.md`
      }

      const targetPath = await pathJoin(path1 || '', fileName)

      return {
        id: fileNode.id,
        kind: createType,
        path: targetPath,
        name: fileName,
      }
    },
    [fileNode, parentNode, createType, pathJoin],
  )

  const verify = useCallback(
    async (name: string) => {
      const version = ++validationVersion.current
      verifing.current = true

      try {
        const fileName = name
        if (fileName === '') {
          setInvalidText(InvalidTextMap.empty)
          setInvalidState(true)
          return
        } else if (verifyFileName(fileName) === false) {
          setInvalidText(InvalidTextMap.invalid)
          setInvalidState(true)
          return
        } else {
          const fileInfo = await getFileInfo(fileName)

          if (fileInfo.path) {
            // For newly created nodes fileNode.path is unset; an empty currentPath
            // can never be the same file as the candidate, so this degrades to a
            // plain existence check.
            const conflict = await hasRenameConflict({
              currentPath: fileNode.path ?? '',
              candidatePath: fileInfo.path,
              fileExists,
              pathsReferToSameDirectoryEntry,
            })

            if (version !== validationVersion.current) return
            if (conflict) {
              setInvalidText(InvalidTextMap.same)
              setInvalidState(true)
            } else {
              setInvalidState(false)
              return fileInfo
            }
          }
        }
      } catch (error) {
        if (version === validationVersion.current) {
          setInvalidText(error instanceof Error ? error.message : String(error))
          setInvalidState(true)
        }
      } finally {
        if (version === validationVersion.current) verifing.current = false
      }
    },
    [
      getFileInfo,
      fileExists,
      pathsReferToSameDirectoryEntry,
      fileNode,
      InvalidTextMap.empty,
      InvalidTextMap.invalid,
      InvalidTextMap.same,
    ],
  )

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    async (e) => {
      e.stopPropagation()
      const fileName = e.target.value
      setInputName(fileName)

      if (!isComposing.current) {
        verify(fileName)
      }
    },
    [verify],
  )

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd: React.CompositionEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      isComposing.current = false
      const fileName = (e.target as HTMLInputElement).value
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
        aria-invalid={invalidState || undefined}
        data-error={invalidState || undefined}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        spellCheck={false}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (
            e.key === 'Escape' &&
            !isComposing.current &&
            !e.nativeEvent.isComposing &&
            e.keyCode !== 229
          ) {
            e.preventDefault()
            if (!creating.current) onCancel()
          }
        }}
        onPressEnter={async (e) => {
          if (e.isComposing || isComposing.current || e.keyCode === 229 || creating.current) return
          e.preventDefault()
          creating.current = true
          try {
            const fileInfo = await verify(inputRef.current?.value ?? inputName)
            if (fileInfo) await onCreate(fileInfo)
          } catch (error) {
            setInvalidText(error instanceof Error ? error.message : String(error))
            setInvalidState(true)
          } finally {
            creating.current = false
          }
        }}
        onBlur={handleBlur}
        {...otherProps}
      ></Input>
    </Tooltip>
  )
}

export default NewFileInput
