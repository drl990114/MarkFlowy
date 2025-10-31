export const Escape = 'Escape'
export const Ctrl = 'Ctrl'
export const CtrlOrCmd = 'CommandOrCtrl'
export const Alt = 'Alt'
export const Shift = 'Shift'

export const isMacOS = /macintosh|mac os x/i.test(navigator.userAgent)
export const isWindows = /win64|win32|wow64|wow32/i.test(navigator.userAgent)
export const isOtherOS = !isMacOS && !isWindows

export function transferKey(key: string) {
  if (isMacOS) {
    return key.replace('CommandOrCtrl', '⌘')
  } else {
    return key.replace('CommandOrCtrl', 'Ctrl')
  }
}

export function recordKey(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()

  if (e.key === 'Escape') {
    return {
      keys: null,
      isExit: true,
      isEnter: false
    }
  }

  const modifiers: Record<string, boolean> = {
    [CtrlOrCmd]: (isMacOS && e.metaKey) || (!isMacOS && e.ctrlKey),
    [Ctrl]: e.ctrlKey && !isMacOS, // 仅在非macOS上保留Ctrl键
    [Alt]: e.altKey,
    [Shift]: e.shiftKey,
  }

  const keys = Object.keys(modifiers).filter((key) => modifiers[key])

  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    let val = e.code
    if (val.startsWith('Key')) {
      val = val.slice(3)
    } else if (val.startsWith('Digit')) {
      val = val.slice(5)
    } else if (val.startsWith('Arrow')) {
      val = val.slice(5)
    } else if (val.startsWith('Numpad')) {
      val = e.code
    } else if (val === 'Equal') {
      val = '='
    } else if ('`-=[]\\;\',./{}|:"<>?~!@#$%^&*()_'.includes(e.key)) {
      val = e.key
    }

    keys.push(val.toLocaleLowerCase())
  }

  if (e.key === 'Enter' && keys.length <= 1) {
    return {
      keys: null,
      isExit: false,
      isEnter: true
    }
  } else {
    return {
      keys: keys,
      isExit: false,
      isEnter: false
    }
  }
}
