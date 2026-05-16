export function formatHref(location: string): string {
  if (isUnixFilePath(location) || isWindowsFilePath(location)) {
    return formatFileUrl(location)
  } else {
    return location
  }
}

function isUnixFilePath(location: string): boolean {
  return location.startsWith('/')
}

function isWindowsFilePath(location: string): boolean {
  return location.startsWith('\\') || /^[A-Z]{1,2}:/.test(location)
}

function formatFileUrl(filePath: string) {
  let pathName = filePath

  pathName = pathName.replace(/\\/g, '/')

  if (pathName[0] !== '/') {
    pathName = `/${pathName}`
  }

  return encodeURI(`file://${pathName}`).replace(/[?#]/g, encodeURIComponent)
}
