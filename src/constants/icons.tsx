import * as Icons from '@icons'

const ICONSMAP = {
  file: Icons.FileIcon,
  folder: Icons.FolderIcon,
  copy: Icons.CopyIcon,
  more: Icons.MoreIcon,
  moreVertical: Icons.MoreVerticalIcon,
  setting: Icons.SettingIcon,
  close: Icons.CloseIcon,
}

export type ICONSNAME = keyof typeof ICONSMAP

export default ICONSMAP
