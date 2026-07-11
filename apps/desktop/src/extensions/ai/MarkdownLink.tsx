import { getFileObjectByPath } from '@/helper/files'
import { getFileNameFromPath, isMdFile } from '@/helper/filesys'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'
import useEditorStore from '@/stores/useEditorStore'
import { openUrl } from '@tauri-apps/plugin-opener'

const OPENABLE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function isOpenableAiLink(href: string | undefined): href is string {
  if (!href) return false

  try {
    return OPENABLE_PROTOCOLS.has(new URL(href).protocol)
  } catch {
    return false
  }
}

export async function openAiLink(href: string | undefined): Promise<boolean> {
  if (!href) return false

  if (isOpenableAiLink(href)) {
    try {
      await openUrl(href)
      return true
    } catch {
      return false
    }
  }

  return openWorkspaceMarkdownLink(href)
}

export async function openWorkspaceMarkdownLink(href: string): Promise<boolean> {
  const rootPath = useEditorStore.getState().getRootPath()
  const path = resolveWorkspaceMarkdownPath(href, rootPath)
  if (!path) return false

  const editor = useEditorStore.getState()
  const cached = getFileObjectByPath(path) ?? editor.getFileNodeByPath(path)
  if (cached) {
    editor.addOpenedFile(cached.id)
    editor.setActiveId(cached.id)
    return true
  }

  const content = await getFileContent({ filePath: path })
  if (content === null) return false
  const fileName = getFileNameFromPath(path)
  await addExistingMarkdownFileEdit({ fileName, path, ext: 'md', content })
  return true
}

export function resolveWorkspaceMarkdownPath(
  href: string,
  rootPath: string | undefined,
): string | undefined {
  if (!rootPath || !href || href.startsWith('#')) return undefined

  let decoded: string
  try {
    decoded = decodeURIComponent(href.split(/[?#]/, 1)[0])
  } catch {
    return undefined
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(decoded) && !decoded.startsWith('file:')) return undefined
  if (decoded.startsWith('file:')) {
    try {
      const fileUrl = new URL(decoded)
      if (fileUrl.hostname) return undefined
      decoded = fileUrl.pathname
      if (/^\/[A-Za-z]:\//.test(decoded)) decoded = decoded.slice(1)
    } catch {
      return undefined
    }
  }

  const normalizedRoot = normalizeLocalPath(rootPath)
  const candidate = isAbsoluteLocalPath(decoded)
    ? normalizeLocalPath(decoded)
    : normalizeLocalPath(`${normalizedRoot}/${decoded}`)
  const caseInsensitive = /^[A-Za-z]:\//.test(normalizedRoot)
  const comparedRoot = caseInsensitive ? normalizedRoot.toLowerCase() : normalizedRoot
  const comparedCandidate = caseInsensitive ? candidate.toLowerCase() : candidate
  const rootPrefix = comparedRoot.endsWith('/') ? comparedRoot : `${comparedRoot}/`
  if (
    comparedCandidate !== comparedRoot &&
    !comparedCandidate.startsWith(rootPrefix)
  ) {
    return undefined
  }
  if (!isMdFile(candidate)) return undefined
  return candidate
}

function isAbsoluteLocalPath(path: string) {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
}

function normalizeLocalPath(path: string) {
  const slashPath = path.replace(/\\/g, '/')
  const drive = slashPath.match(/^[A-Za-z]:/)?.[0] ?? ''
  const absolute = slashPath.startsWith('/') || Boolean(drive)
  const source = drive ? slashPath.slice(drive.length) : slashPath
  const segments: string[] = []
  for (const segment of source.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  const prefix = drive || (absolute ? '/' : '')
  return `${prefix}${prefix && prefix !== '/' ? '/' : ''}${segments.join('/')}` || '/'
}
