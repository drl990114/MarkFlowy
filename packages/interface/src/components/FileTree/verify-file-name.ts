export const unVerifiedFileNameChars = ['<', '>', ':', '"', '|', '?', '*', '/']

export function verifyFileName(fileName: string): boolean {
  for (const char of unVerifiedFileNameChars) {
    if (fileName.includes(char)) {
      return false
    }
  }
  return true
}

export function isMdFile(fileName?: string): boolean {
  if (!fileName) return false
  return fileName.endsWith('.md')
}

export function getFileNameFromPath(filePath: string): string {
  if (filePath.endsWith('/')) {
    filePath = filePath.slice(0, -1)
  }

  const regex = /[\/\\]([^\/\\]+)$/
  const match = regex.exec(filePath)

  if (match && match.length > 1) {
    return match[1]
  }

  return filePath
}

export function getFolderPathFromPath(filePath?: string): string | undefined {
  if (!filePath) return filePath

  const regex = /^(.*)[\/\\][^\/\\]+$/
  const match = regex.exec(filePath)

  if (match && match.length > 1) {
    return match[1]
  }

  return filePath
}
