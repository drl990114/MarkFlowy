import { DeferredSurface } from '@/components/DeferredSurface'
import { commandRegistry } from '@/commands'
import { keybindingPlatform } from '@/commands/keybindingKeys'
import { Dialog } from '@/components/ui/dialog'
import { EVENT } from '@/constants'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'zens'
import { captureEditorCommandTarget, releaseEditorCommandTarget } from './editorCommandTarget'
import type { CommandPaletteContext, PaletteCommand } from './paletteCommands'
import { useCommandHistoryStore } from './useCommandHistoryStore'

export interface PaletteSession extends CommandPaletteContext {
  origin: HTMLElement | null
  submitted: boolean
}

const loadPalette = () => import('./CommandPaletteContent')

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
        <Dialog.Description className='sr-only'>{t('command_palette.placeholder')}</Dialog.Description>
        {open && session ? (
          <DeferredSurface
            load={loadPalette}
            loadingLabel={t('common.fetching')}
            errorTitle={t('common.error')}
            retryLabel={t('common.retry')}
          >
            {({ PaletteContent }) => (
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
            )}
          </DeferredSurface>
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  )
}
