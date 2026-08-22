import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { commandRegistry } from '@/commands'
import { useTranslation } from '@/i18n'
import { ListOrderedIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EditorContext } from 'rme'

type HeadingNumberingCommands = {
  applyHeadingNumbering?: () => boolean
  removeHeadingNumbering?: () => boolean
}

type HeadingNumberingHelpers = {
  getHeadingNumbering?: () => {
    complete: boolean
  }
}

type HeadingNumberingApi = {
  apply: () => boolean
  getAnalysis: () => { complete: boolean }
  remove: () => boolean
}

function getHeadingNumberingApi(editorCtx: EditorContext): HeadingNumberingApi | null {
  const commands = editorCtx.commands as unknown as HeadingNumberingCommands
  const helpers = editorCtx.helpers as unknown as HeadingNumberingHelpers

  if (
    typeof commands.applyHeadingNumbering !== 'function' ||
    typeof commands.removeHeadingNumbering !== 'function' ||
    typeof helpers.getHeadingNumbering !== 'function'
  ) {
    return null
  }

  return {
    apply: commands.applyHeadingNumbering,
    getAnalysis: helpers.getHeadingNumbering,
    remove: commands.removeHeadingNumbering,
  }
}

export function hasHeadingNumberingCapability(editorCtx: EditorContext): boolean {
  return getHeadingNumberingApi(editorCtx) !== null
}

export function HeadingNumberingButton(props: { editorCtx: EditorContext }) {
  return hasHeadingNumberingCapability(props.editorCtx) ? (
    <HeadingNumberingButtonReady editorCtx={props.editorCtx} />
  ) : null
}

function HeadingNumberingButtonReady(props: { editorCtx: EditorContext }) {
  const { editorCtx } = props
  const { t } = useTranslation()
  const label = t('sidebar.heading_numbering') || 'Heading numbering'
  const [numberingEnabled, setNumberingEnabled] = useState(
    () => getHeadingNumberingApi(editorCtx)!.getAnalysis().complete,
  )

  useEffect(() => {
    const syncNumberingState = () => {
      setNumberingEnabled(getHeadingNumberingApi(editorCtx)!.getAnalysis().complete)
    }

    syncNumberingState()
    return editorCtx.addHandler('updated', syncNumberingState)
  }, [editorCtx])

  const handleClick = () => {
    const api = getHeadingNumberingApi(editorCtx)!
    const wasEnabled = api.getAnalysis().complete
    const changed = wasEnabled ? api.remove() : api.apply()

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
