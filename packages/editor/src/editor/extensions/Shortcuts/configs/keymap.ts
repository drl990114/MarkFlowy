export interface KeymapConfig {
  [key: string]: string
}

// TODO copy and paste need development (and codemirror)
export const rmeDefaultKeymap: KeymapConfig = {
  'mod-z': 'undo',
  'mod-y': 'redo',
  'mod-shift-z': 'redo',
  'mod-b': 'toggleStrong',
  'mod-i': 'toggleEmphasis',
  'mod-e': 'toggleCodeText',
  'mod-shift-s': 'toggleDelete'
}

export const getKeybindByCommandName = (commandName: string) => {
  for (const key in rmeDefaultKeymap) {
    if (rmeDefaultKeymap[key] === commandName) {
      return key
    }
  }
  return null
}
