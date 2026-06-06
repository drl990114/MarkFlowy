import useAppSettingStore from '@/stores/useAppSettingStore'
import { EditorViewType } from 'rme'
import { IFile } from './filesys'

export type FileType = 'markdown' | 'image' | 'json' | 'text' | 'unsupported'

export interface FileTypeConfig {
  type: FileType
  supportedModes: Array<EditorViewType>
  defaultMode: EditorViewType
  exporters?: Array<string>
}

export const isTextfileType = (fileTypeConfig: FileTypeConfig): boolean => {
  return ['markdown', 'json', 'text'].includes(fileTypeConfig.type)
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'log', 'csv', 'tsv',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'py', 'pyw', 'pyi',
  'rb', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php',
  'swift', 'kt', 'kts', 'scala', 'r', 'm', 'mm',
  'pl', 'pm', 'lua', 'vim', 'el', 'clj', 'hs', 'ml', 'fs', 'dart', 'groovy',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'styl',
  'vue', 'svelte', 'astro',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env', 'properties',
  'xml', 'plist', 'gradle', 'cmake',
  'sql', 'graphql', 'gql',
  'mdx', 'tex', 'org', 'adoc', 'rst',
  'diff', 'patch',
  'dockerfile', 'makefile',
  'gitignore', 'editorconfig', 'prettierrc', 'eslintrc', 'babelrc',
  'npmrc', 'nvmrc', 'node-version',
  'lock',
  'tf', 'tfvars', 'hcl',
  'proto', 'graphqls',
  'res', 'resi',
  'ex', 'exs',
  'erl',
  'sol',
  'asm', 's',
  'v', 'sv', 'svh',
  'vhd', 'vhdl',
  'tcl',
  'rake', 'gemspec',
  'podspec',
  'cmake',
  'meson',
  'bazel', 'bzl',
  'snippets',
  'toml',
])

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
])

const BINARY_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib',
  'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'dmg', 'iso',
  'mp3', 'mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'webm',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'psd', 'ai', 'eps',
  'ttf', 'otf', 'woff', 'woff2',
  'sqlite', 'db',
  'pyc', 'class', 'o', 'obj',
  'bin', 'dat', 'wasm',
])

const FILES_WITHOUT_EXT = new Set([
  'dockerfile', 'makefile', 'rakefile', 'gemfile', 'procfile',
  'vagrantfile', 'brewfile', 'podfile', 'fastfile',
  'cmakelists', 'jenkinsfile',
])

function isTextExtension(ext: string): boolean {
  if (!ext) return false
  return TEXT_EXTENSIONS.has(ext.toLowerCase())
}

function isImageExtension(ext: string): boolean {
  if (!ext) return false
  return IMAGE_EXTENSIONS.has(ext.toLowerCase())
}

function isBinaryExtension(ext: string): boolean {
  if (!ext) return false
  return BINARY_EXTENSIONS.has(ext.toLowerCase())
}

function isKnownNoExtFileName(fileName: string): boolean {
  if (!fileName) return false
  const lower = fileName.toLowerCase()
  if (FILES_WITHOUT_EXT.has(lower)) return true
  for (const name of FILES_WITHOUT_EXT) {
    if (lower.startsWith(name + '.')) return true
  }
  return false
}

const TEXT_FILE_TYPE_CONFIG: FileTypeConfig = {
  type: 'text',
  supportedModes: [EditorViewType.SOURCECODE],
  defaultMode: EditorViewType.SOURCECODE,
}

const UNSUPPORTED_FILE_TYPE_CONFIG: FileTypeConfig = {
  type: 'unsupported',
  supportedModes: [],
  defaultMode: EditorViewType.PREVIEW,
}

export async function getFileTypeConfig(file: IFile): Promise<FileTypeConfig> {
  const extLower = (file.ext || file.name?.split('.').pop() || '').toLowerCase()
  const { settingData } = useAppSettingStore.getState()

  if (extLower === 'md' || extLower === 'markdown') {
    return {
      type: 'markdown',
      supportedModes: [EditorViewType.PREVIEW, EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
      defaultMode: settingData.md_editor_default_mode || EditorViewType.WYSIWYG,
      exporters: ['Html', 'Image'],
    }
  }

  if (extLower === 'json') {
    return {
      type: 'json',
      supportedModes: [EditorViewType.SOURCECODE],
      defaultMode: EditorViewType.SOURCECODE,
    }
  }

  if (isImageExtension(extLower)) {
    return {
      type: 'image',
      supportedModes: [EditorViewType.PREVIEW],
      defaultMode: EditorViewType.PREVIEW,
    }
  }

  if (isTextExtension(extLower)) {
    return TEXT_FILE_TYPE_CONFIG
  }

  if (isBinaryExtension(extLower)) {
    return UNSUPPORTED_FILE_TYPE_CONFIG
  }

  if (isKnownNoExtFileName(file.name || '')) {
    return TEXT_FILE_TYPE_CONFIG
  }

  return TEXT_FILE_TYPE_CONFIG
}

export function isSupportedMode(config: FileTypeConfig, mode: string): boolean {
  return config.supportedModes.includes(mode as any)
}
