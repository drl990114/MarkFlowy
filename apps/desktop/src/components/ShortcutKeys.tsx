import {
  formatKeyMap,
  normalizeKeyMap,
  type KeybindingPlatform,
} from '@/commands/keybindingKeys'
import { useCommandKeybinding } from '@/commands/useCommandShortcut'
import { Kbd, KbdGroup, type KbdGroupProps } from '@/components/ui/kbd'

export type ShortcutKeysProps = Omit<KbdGroupProps, 'children'> & {
  keys: readonly string[]
  platform?: KeybindingPlatform
}

export function ShortcutKeys({ keys, platform, ...props }: ShortcutKeysProps) {
  if (!keys.length) return null

  return (
    <KbdGroup {...props}>
      <span className='sr-only'>{formatKeyMap(keys, platform)}</span>
      {(normalizeKeyMap(keys) ?? keys).map((key) => {
        // Format each stored key directly so a literal + keeps its own keycap.
        const label = formatKeyMap([key], platform)
        return (
          <Kbd
            key={key}
            aria-hidden='true'
            className={label.length === 1 ? 'w-5 px-0' : undefined}
          >
            {label}
          </Kbd>
        )
      })}
    </KbdGroup>
  )
}

export type CommandShortcutKeysProps = Omit<ShortcutKeysProps, 'keys'> & { commandId: string }

export function CommandShortcutKeys({ commandId, ...props }: CommandShortcutKeysProps) {
  const binding = useCommandKeybinding(commandId)
  return binding?.keys.length ? <ShortcutKeys keys={binding.keys} {...props} /> : null
}
