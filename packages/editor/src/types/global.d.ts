declare namespace Global {
  interface FileEntry {
    name: string
    kind: 'file' | 'dir'
    path?: string
    children?: IFile[]
  }

  export interface IFile extends FileEntry {
    id: string
    content?: string
  }
}
