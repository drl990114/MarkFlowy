import { isBrowser } from './common'

export function getOS() {
  if (!isBrowser()) return 'Unknown'
  const userAgent = window.navigator.userAgent
  const platform = window.navigator.platform

  if (/Win/.test(platform) || /Win/.test(userAgent)) {
    return 'Windows'
  } else if (/Mac/.test(platform) || /Mac/.test(userAgent)) {
    return 'macOS'
  } else {
    return 'Unknown' // 可能是Linux、iOS、Android或其他系统
  }
}

export function getModKeyIconName() {
  const os = getOS()
  return os === 'macOS' ? <i className="ri-command-line" /> : 'Ctrl'
}

export function getModEventKey() {
  const os = getOS()
  return os === 'macOS' ? 'metaKey' : 'ctrlKey'
}
