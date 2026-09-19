import { commandRegistry } from '@/commands'
import { keybindingPlatform } from '@/commands/keybindingKeys'
import { CommandShortcutKeys } from '@/components/ShortcutKeys'
import { Command } from '@/components/ui/command'
import { Dialog } from '@/components/ui/dialog'
import { EVENT } from '@/constants'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'zens'
import { rankPaletteCommands } from './commandPaletteSearch'
import { captureEditorCommandTarget, releaseEditorCommandTarget } from './editorCommands'
import {
  COMMAND_CATEGORIES,
  paletteCommands,
  type CommandPaletteContext,
  type PaletteCommand,
} from './paletteCommands'
import { useCommandHistoryStore } from './useCommandHistoryStore'
import { usePaletteUpdates } from './usePaletteUpdates'

interface PaletteSession extends CommandPaletteContext {
  origin: HTMLElement | null
  submitted: boolean
}

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
      className='min-h-8 gap-3'
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

function PaletteContent({
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

export function CommandPaletteDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<PaletteSession | null>(null)
  const sessionRef = useRef<PaletteSession | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<PaletteCommand | null>(null)
  const closingRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const registration = commandRegistry.registerCommand({
      id: EVENT.app_commandPalette,
      handler: () => {
        if (closingRef.current) return
        if (sessionRef.current) {
          inputRef.current?.focus()
          inputRef.current?.select()
          return
        }
        const next: PaletteSession = {
          target: captureEditorCommandTarget(),
          platform: keybindingPlatform(),
          submitted: false,
          origin: document.activeElement instanceof HTMLElement ? document.activeElement : null,
        }
        sessionRef.current = next
        setSession(next)
        setOpen(true)
      },
    })
    return () => {
      mountedRef.current = false
      registration.dispose()
      releaseEditorCommandTarget(sessionRef.current?.target ?? null)
      sessionRef.current = null
      pendingRef.current = null
    }
  }, [])

  const close = () => {
    closingRef.current = true
    setOpen(false)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <Dialog.Content
        data-mf-command-palette=''
        className='top-[min(18vh,8rem)] max-w-[560px] translate-y-0 gap-0 p-0 [&>[data-slot=dialog-close]]:top-2'
        closeLabel={t('common.close')}
        onEscapeKeyDown={(event) => {
          if (event.isComposing || event.keyCode === 229 || event.repeat) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          const previous = sessionRef.current
          const command = pendingRef.current
          sessionRef.current = null
          pendingRef.current = null
          closingRef.current = false
          if (!previous || !mountedRef.current) return
          setSession(null)
          if (!command) {
            releaseEditorCommandTarget(previous.target)
            return
          }
          event.preventDefault()
          // Run after Radix releases the old focus trap, before another input event.
          queueMicrotask(() => {
            if (!mountedRef.current) {
              releaseEditorCommandTarget(previous.target)
              return
            }
            if (previous.origin?.isConnected) previous.origin.focus({ preventScroll: true })
            void (async () => {
              try {
                const reason = command.getUnavailableReason(previous)
                if (reason) {
                  toast.error(t(`command_palette.reasons.${reason}`))
                  return
                }
                if (await command.execute(previous))
                  useCommandHistoryStore.getState().record(command.id)
              } catch (error) {
                logger.error('Command palette execution failed', error)
                toast.error(t('command_palette.failed', { command: t(command.labelKey) }))
              } finally {
                releaseEditorCommandTarget(previous.target)
              }
            })()
          })
        }}
      >
        <Dialog.Title className='sr-only'>{t('command_palette.title')}</Dialog.Title>
        <Dialog.Description className='sr-only'>
          {t('command_palette.placeholder')}
        </Dialog.Description>
        {open && session ? (
          <PaletteContent
            session={session}
            inputRef={inputRef}
            onSelect={(command) => {
              if (session.submitted || command.getUnavailableReason(session)) return
              session.submitted = true
              pendingRef.current = command
              close()
            }}
          />
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  )
}
