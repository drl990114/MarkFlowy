import { CommandShortcutKeys } from '@/components/ShortcutKeys'
import { Command } from '@/components/ui/command'
import { useTranslation } from '@/i18n'
import { useState } from 'react'
import { rankPaletteCommands } from './commandPaletteSearch'
import { COMMAND_CATEGORIES, paletteCommands, type PaletteCommand } from './paletteCommands'
import { useCommandHistoryStore } from './useCommandHistoryStore'
import { usePaletteUpdates } from './usePaletteUpdates'
import type { PaletteSession } from './CommandPaletteDialog'

function CommandRow({
  command,
  session,
  onSelect,
}: {
  command: PaletteCommand
  session: PaletteSession
  onSelect: (command: PaletteCommand) => void
}) {
  const { t } = useTranslation()
  const reason = command.getUnavailableReason(session)
  return (
    <Command.Item
      value={command.id}
      disabled={Boolean(reason)}
      onSelect={() => onSelect(command)}
      className='min-h-7 gap-2'
    >
      <span className='min-w-0 flex-1'>
        <span className='block truncate'>{t(command.labelKey)}</span>
        {reason ? (
          <span className='block text-ui-caption text-muted-foreground'>
            {t(`command_palette.reasons.${reason}`)}
          </span>
        ) : null}
      </span>
      <CommandShortcutKeys
        commandId={command.id}
        className={reason ? 'text-content-disabled' : undefined}
      />
    </Command.Item>
  )
}

export function PaletteContent({
  session,
  inputRef,
  onSelect,
}: {
  session: PaletteSession
  inputRef: React.RefObject<HTMLInputElement | null>
  onSelect: (command: PaletteCommand) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const recent = useCommandHistoryStore((state) => state.recent)
  usePaletteUpdates(session.target)
  const matches = rankPaletteCommands(
    paletteCommands.map((command) => ({
      ...command,
      label: t(command.labelKey),
      categoryLabel: t(`command_palette.categories.${command.category}`),
      keywords: [
        ...command.keywords,
        t(command.labelKey, { lng: 'en' }),
        t(`command_palette.categories.${command.category}`, { lng: 'en' }),
      ],
    })),
    query,
    recent,
  )
  const recentCommands = recent
    .flatMap((id) => matches.filter((command) => command.id === id))
    .slice(0, 5)
  const recentIds = new Set(recentCommands.map((command) => command.id))
  const groups = query.trim()
    ? [{ key: 'matches', label: undefined, commands: matches }]
    : [
        { key: 'recent', label: t('command_palette.recent'), commands: recentCommands },
        ...COMMAND_CATEGORIES.map((category) => ({
          key: category,
          label: t(`command_palette.categories.${category}`),
          commands: matches.filter(
            (command) => command.category === category && !recentIds.has(command.id),
          ),
        })),
      ]
  const available = groups
    .flatMap((group) => group.commands)
    .filter((command) => !command.getUnavailableReason(session))
  const value = available.some((command) => command.id === selectedId)
    ? selectedId
    : (available[0]?.id ?? '')

  return (
    <Command
      label={t('command_palette.title')}
      shouldFilter={false}
      loop
      value={value}
      onValueChange={setSelectedId}
      onKeyDownCapture={(event) => {
        if (
          (event.key === 'Enter' || event.key === 'Escape') &&
          (event.nativeEvent.isComposing || event.keyCode === 229 || event.repeat)
        ) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      <Command.Input
        autoFocus
        ref={inputRef}
        className='h-10 pr-8'
        value={query}
        onValueChange={(next) => {
          setQuery(next)
          setSelectedId('')
        }}
        placeholder={t('command_palette.placeholder')}
      />
      <Command.List className='max-h-[min(360px,50vh)]'>
        <Command.Empty>{t('command_palette.empty')}</Command.Empty>
        {groups
          .filter((group) => group.commands.length)
          .map((group) => (
            <Command.Group key={group.key} heading={group.label}>
              {group.commands.map((command) => (
                <CommandRow
                  key={command.id}
                  command={command}
                  session={session}
                  onSelect={onSelect}
                />
              ))}
            </Command.Group>
          ))}
      </Command.List>
      <div className='border-t border-border px-3 py-1.5 text-ui-caption text-muted-foreground'>
        {t('command_palette.hints')}
      </div>
    </Command>
  )
}
