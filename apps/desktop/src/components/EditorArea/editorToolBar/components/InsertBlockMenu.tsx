import { useEffect, useRef, useState } from 'react'
import { CodeXmlIcon, PlusIcon, SigmaIcon } from 'lucide-react'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemPrimitive,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/i18n'
import { logger } from '@/helper/logger'
import {
  captureEditorCommandTarget,
  editorCommandUnavailable,
  executeEditorPaletteCommand,
  releaseEditorCommandTarget,
  type EditorCommandTarget,
} from '@/extensions/command-palette/editorCommands'
import { EditorAreaActionButton } from '../../EditorAreaAction'

const items = [
  { command: 'editor_insertCodeBlock', label: 'toolbar.codeBlock', icon: CodeXmlIcon },
  { command: 'editor_insertMathBlock', label: 'toolbar.mathBlock', icon: SigmaIcon },
] as const
type InsertCommand = (typeof items)[number]['command']

export function InsertBlockMenu({ editorId, groupId }: { editorId?: string; groupId?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const target = useRef<EditorCommandTarget | null>(null)
  const pendingCommand = useRef<InsertCommand | null>(null)
  useEffect(() => () => {
    releaseEditorCommandTarget(target.current)
    target.current = null
    pendingCommand.current = null
  }, [])

  return (
    <DropdownMenuRoot
      open={open}
      onOpenChange={(next) => {
        if (next) {
          releaseEditorCommandTarget(target.current)
          target.current = editorId ? captureEditorCommandTarget({ fileId: editorId, groupId }) : null
          pendingCommand.current = null
        }
        setOpen(next)
      }}
    >
      <DropdownMenuTrigger asChild>
        <EditorAreaActionButton icon={PlusIcon} label={t('toolbar.insert')} disabled={!editorId} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='start'
        sideOffset={4}
        onCloseAutoFocus={(event) => {
          const captured = target.current
          const command = pendingCommand.current
          target.current = null
          pendingCommand.current = null
          if (!command) {
            releaseEditorCommandTarget(captured)
            return
          }
          // Restore the editor only after the menu's focus trap is gone.
          event.preventDefault()
          void executeEditorPaletteCommand(captured, command)
            .catch((error) => logger.error('Block insertion failed', error))
            .finally(() => releaseEditorCommandTarget(captured))
        }}
      >
        {items.map(({ command, label, icon: Icon }) => (
          <DropdownMenuItemPrimitive
            key={command}
            disabled={Boolean(editorCommandUnavailable(target.current, command))}
            onSelect={() => {
              pendingCommand.current = command
            }}
          >
            <Icon aria-hidden='true' className='size-3.5' />
            {t(label)}
          </DropdownMenuItemPrimitive>
        ))}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  )
}
