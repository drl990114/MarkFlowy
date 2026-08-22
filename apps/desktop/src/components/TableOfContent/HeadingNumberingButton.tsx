import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { commandRegistry } from '@/commands'
import { useTranslation } from '@/i18n'
import { ListOrderedIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EditorContext } from 'rme'

type HeadingNumberingCommands = {
  applyHeadingNumbering: () => boolean
  removeHeadingNumbering: () => boolean
}

type HeadingNumberingHelpers = {
  getHeadingNumbering: () => {
    complete: boolean
  }
}

function getCommands(editorCtx: EditorContext): HeadingNumberingCommands {
  return editorCtx.commands as unknown as HeadingNumberingCommands
}

function getAnalysis(editorCtx: EditorContext) {
  const helpers = editorCtx.helpers as unknown as HeadingNumberingHelpers
  return helpers.getHeadingNumbering()
}

export function HeadingNumberingButton(props: { editorCtx: EditorContext }) {
  const { editorCtx } = props
  const { t } = useTranslation()
  const label = t('sidebar.heading_numbering') || 'Heading numbering'
  const [numberingEnabled, setNumberingEnabled] = useState(
    () => getAnalysis(editorCtx).complete,
  )

  useEffect(() => {
    const syncNumberingState = () => {
      setNumberingEnabled(getAnalysis(editorCtx).complete)
    }

    syncNumberingState()
    return editorCtx.addHandler('updated', syncNumberingState)
  }, [editorCtx])

  const handleClick = () => {
    const commands = getCommands(editorCtx)
    const wasEnabled = getAnalysis(editorCtx).complete
    const changed = wasEnabled
      ? commands.removeHeadingNumbering()
      : commands.applyHeadingNumbering()

    if (changed) {
      setNumberingEnabled(!wasEnabled)
    }
    commandRegistry.execute('app:toc_refresh')
    editorCtx.view.focus()
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={numberingEnabled}
          onClick={handleClick}
          size='icon-chrome'
          variant='chrome'
        >
          <ListOrderedIcon aria-hidden='true' strokeWidth={1.75} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
