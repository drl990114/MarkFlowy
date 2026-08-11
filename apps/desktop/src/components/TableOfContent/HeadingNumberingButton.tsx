import { Button } from '@/components/ui/button'
import { commandRegistry } from '@/commands'
import { useTranslation } from '@/i18n'
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

  const handleClick = () => {
    const commands = getCommands(editorCtx)
    if (getAnalysis(editorCtx).complete) {
      commands.removeHeadingNumbering()
    } else {
      commands.applyHeadingNumbering()
    }
    commandRegistry.execute('app:toc_refresh')
    editorCtx.view.focus()
  }

  return (
    <Button
      aria-label={label}
      className='icon icon-small icon-smooth size-[22px] rounded-md text-[0.85rem]'
      onClick={handleClick}
      size='icon-sm'
      title={label}
      variant='ghost'
    >
      <i className='ri-list-ordered-2' aria-hidden='true' />
    </Button>
  )
}
