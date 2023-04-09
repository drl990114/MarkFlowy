import * as Icons from '@icons'

const ICONSMAP = {
  file: Icons.FileIcon,
  folder: Icons.FolderIcon,
  copy: Icons.CopyIcon,
}

export type ICONSNAME = keyof typeof ICONSMAP

export default ICONSMAP
