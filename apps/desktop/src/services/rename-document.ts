import { verifyFileName, type FileSystemContextValue, type IFile } from '@markflowy/interface'
import { getFileObject } from '@/helper/files'
import { updateFile } from '@/helper/filesys'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'

export type RenameDocumentErrorCode = 'empty' | 'invalid' | 'exists'

export class RenameDocumentError extends Error {
  constructor(readonly code: RenameDocumentErrorCode) {
    super(code)
    this.name = 'RenameDocumentError'
  }
}

export type RenameDocumentTarget = Pick<IFile, 'id' | 'path' | 'name'>
export type RenameDocumentFileSystem = Pick<
  FileSystemContextValue,
  'runFileMutation' | 'pathJoin' | 'fileExists' | 'pathsReferToSameDirectoryEntry' | 'renameFile'
>
export type RenameDocumentResult = 'renamed' | 'unchanged' | 'stale'

function documentName(target: RenameDocumentTarget, enteredName: string): string {
  const name = enteredName.trim()
  if (!name) throw new RenameDocumentError('empty')
  if (
    !verifyFileName(name) ||
    name.includes('\\') ||
    [...name].some((character) => character.charCodeAt(0) < 32) ||
    name === '.' ||
    name === '..' ||
    name.endsWith('.')
  ) {
    throw new RenameDocumentError('invalid')
  }

  const extensionStart = target.name.lastIndexOf('.')
  // Keep the current format when the user edits only the basename.
  return !name.includes('.') && extensionStart > 0
    ? `${name}${target.name.slice(extensionStart)}`
    : name
}

function currentDocument(target: RenameDocumentTarget): IFile | undefined {
  const editor = useEditorStore.getState()
  const file = getFileObject(target.id)
  if (
    editor.getRootPath() ||
    !editor.opened.includes(target.id) ||
    file?.kind !== 'file' ||
    file.path !== target.path ||
    file.name !== target.name
  ) return undefined
  return file
}

/** Rename a standalone document without replacing its live editor or draft. */
export async function renameDocument(
  target: RenameDocumentTarget,
  enteredName: string,
  fileSystem: RenameDocumentFileSystem,
): Promise<RenameDocumentResult> {
  const name = documentName(target, enteredName)
  const extensionStart = name.lastIndexOf('.')
  const ext = extensionStart > 0 ? name.slice(extensionStart + 1) : ''
  return fileSystem.runFileMutation(async (lease) => {
    if (!currentDocument(target)) return 'stale'
    if (name === target.name) return 'unchanged'
    lease.protectFileIds([target.id])

    if (!target.path) {
      updateFile({ id: target.id, name, ext })
      const state = useEditorStateStore.getState()
      // A deliberately named empty draft must survive placeholder cleanup and
      // reach the Save dialog, whose normal entry point checks the dirty flag.
      state.setIdStateMap(target.id, {
        ...state.idStateMap.get(target.id),
        hasUnsavedChanges: true,
      })
      return 'renamed'
    }

    lease.protectPaths([target.path])
    const separator = Math.max(target.path.lastIndexOf('/'), target.path.lastIndexOf('\\'))
    const rootLength = /^[a-z]:[\\/]/i.test(target.path) ? 3 : 1
    const parentPath = target.path.slice(0, Math.max(separator, rootLength))
    const nextPath = await fileSystem.pathJoin(parentPath, name)
    lease.protectPaths([nextPath])

    // Match Explorer's directory-entry check: case/Unicode-only renames are
    // allowed, while a different existing entry (including a hard link) is not.
    if (
      await fileSystem.fileExists(nextPath) &&
      !await fileSystem.pathsReferToSameDirectoryEntry(target.path, nextPath)
    ) throw new RenameDocumentError('exists')
    if (!currentDocument(target)) return 'stale'

    await fileSystem.renameFile(target.path, nextPath)
    // Metadata-only updates merge the latest cached content and preserve the
    // document identity, undo history, dirty flag and queued autosave writes.
    if (getFileObject(target.id)?.path === target.path) {
      updateFile({ id: target.id, name, path: nextPath, ext })
    }
    return 'renamed'
  })
}
