import { Fragment } from 'react'
import {
  formatKeyMap,
  keybindingPlatform,
  normalizeKeyMap,
  type KeybindingPlatform,
} from '@/commands/keybindingKeys'
import { useCommandKeybinding } from '@/commands/useCommandShortcut'
import { Kbd, KbdGroup, type KbdGroupProps } from '@/components/ui/kbd'

export type ShortcutKeysProps = Omit<KbdGroupProps, 'children'> & {
  keys: readonly string[]
  platform?: KeybindingPlatform
}

export function ShortcutKeys({ keys, platform = keybindingPlatform(), ...props }: ShortcutKeysProps) {
  if (!keys.length) return null

  return (
    <KbdGroup {...props}>
      <span className='sr-only'>{formatKeyMap(keys, platform)}</span>
      {(normalizeKeyMap(keys) ?? keys).map((key, index) => {
        // Format stored keys directly so a literal + is distinct from a separator.
        const label = formatKeyMap([key], platform)
        return (
          <Fragment key={key}>
            {index > 0 && platform !== 'mac' ? <span aria-hidden='true'>+</span> : null}
            <Kbd aria-hidden='true'>{label}</Kbd>
          </Fragment>
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
