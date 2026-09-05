import type {
  CapricornKeybindingConfiguration,
  CapricornRuntimeOptions,
} from './capricornRuntimeAdapter'

const editorRules: Readonly<Record<string, string>> = {
  undo: 'editor.history.undo.default',
  redo: 'editor.history.redo.default',
  toggleStrong: 'editor.format.bold.default',
  toggleEmphasis: 'editor.format.italic.default',
  toggleCodeText: 'editor.format.code.default',
  toggleDelete: 'editor.format.strike.default',
  insertCurrentDate: 'editor.insert.currentDate.default',
  ...Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => [
      `toggleH${index + 1}`,
      `editor.block.heading.${index + 1}.default`,
    ]),
  ),
}

export function toCapricornShortcut(shortcut: string): string {
  // Only replace modifier separators: the primary key itself can be '-' or '+'.
  return shortcut
    .replace(/^(?:(?:mod|ctrl|control|meta|cmd|command|alt|option|shift)-)+/i, (modifiers) =>
      modifiers.replaceAll('-', '+'),
    )
    .replace(/\b(Numpad(?:[0-9]|Add|Comma|Decimal|Divide|Multiply|Subtract))$/, '[$1]')
}

export function createCapricornKeybindingConfiguration(
  keymap: Readonly<Record<string, string>>,
  loaded: boolean,
): CapricornKeybindingConfiguration {
  const configuration: CapricornKeybindingConfiguration = {
    inheritDefaults: true,
    customizations: [],
  }
  if (!loaded) return configuration
  const customizations: CapricornKeybindingConfiguration['customizations'][number][] =
    Object.entries(editorRules).map(([name, targetRuleId]) =>
      keymap[name]
        ? { type: 'replace', targetRuleId, keys: toCapricornShortcut(keymap[name]) }
        : { type: 'disable', targetRuleId },
    )

  // Native clipboard shortcuts are reserved by Capricorn. Additional user
  // shortcuts invoke that same clipboard event path, including safe cut handling.
  for (const action of ['copy', 'cut'] as const) {
    const keys = toCapricornShortcut(keymap[action] ?? '')
    if (!keys || keys.toLowerCase() === `mod+${action === 'copy' ? 'c' : 'x'}`) continue
    customizations.push({
      type: 'add',
      rule: {
        id: `host.clipboard.${action}.custom`,
        command: `host.clipboard.${action}`,
        keys,
        when: { context: 'editor.focused', op: 'truthy' },
      },
    })
  }
  return { ...configuration, customizations }
}

export const capricornClipboardCommands: CapricornRuntimeOptions['commands'] = (
  ['copy', 'cut'] as const
).map((action) => ({
  id: `host.clipboard.${action}`,
  label: action,
  precondition: { context: action === 'cut' ? 'editor.editable' : 'editor.focused', op: 'truthy' },
  execute: ({ event }) => {
    const input = event?.target
    if (!(input instanceof HTMLTextAreaElement) || !input.hasAttribute('data-cap-input'))
      return false
    const { value, selectionStart, selectionEnd, selectionDirection } = input
    try {
      // Match the runtime's own context-menu bridge: WebViews require a native
      // textarea selection before they dispatch a copy/cut event.
      input.value = ' '
      input.select()
      return input.ownerDocument.execCommand(action)
    } finally {
      input.value = value
      input.setSelectionRange(selectionStart, selectionEnd, selectionDirection)
    }
  },
}))
