export interface FileEntry {
  name: string
  kind:
    | 'file'
    | 'dir'
    | 'pending_new_file'
    | 'pending_new_folder'
    | 'pending_edit_folder'
    | 'pending_edit_file'
    | 'new_tab'
  path?: string
  children?: IFile[]
  ext?: string
}

export interface IFile extends FileEntry {
  id: string
  content?: string
}

export enum FileResultCode {
  Success = 'Success',
  NotFound = 'NotFound',
  PermissionDenied = 'PermissionDenied',
  InvalidPath = 'InvalidPath',
  UnknownError = 'UnknownError',
}

export interface FileSysResult {
  code: FileResultCode
  content: string
}
