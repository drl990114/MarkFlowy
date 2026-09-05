import { type FC } from 'react'
import type { EditorContext } from 'rme'
import type { CapricornRuntimeAdapter } from '../../capricornRuntimeAdapter'
import { FindController } from './find-controller'
import { FindInput } from './find-input'
import { ReplaceController } from './replace-controller'
import { ReplaceInput } from './replace-input'
import { useFindReplace } from './use-find-replace'
import { useCapricornFindReplace } from './use-capricorn-find-replace'

export interface FindReplaceComponentProps {
  onDismiss?: () => void
  editorCtx: EditorContext
}

export const FindReplaceComponent: FC<FindReplaceComponentProps> = ({ onDismiss, editorCtx }) => {
  const controller = useFindReplace(editorCtx)
  return <FindReplaceControls controller={controller} onDismiss={onDismiss} />
}

export const CapricornFindReplaceComponent: FC<{
  editor: CapricornRuntimeAdapter
  onDismiss?: () => void
}> = ({ editor, onDismiss }) => {
  const controller = useCapricornFindReplace(editor)
  return <FindReplaceControls controller={controller} onDismiss={onDismiss} />
}

type FindReplaceControlsProps = {
  controller: ReturnType<typeof useFindReplace> | ReturnType<typeof useCapricornFindReplace>
  onDismiss?: () => void
}

function FindReplaceControls({ controller, onDismiss }: FindReplaceControlsProps) {
  const {
    query,
    setQuery,
    activeIndex,
    total,
    caseSensitive,
    replacement,
    setReplacement,
    toggleCaseSensitive,
    findNext,
    findPrev,
    stopFind,
    replace,
    replaceAll,
  } = controller

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-nowrap gap-1'>
        <FindInput query={query} setQuery={setQuery} total={total} activeIndex={activeIndex} />
        <FindController
          findPrev={findPrev}
          findNext={findNext}
          toggleCaseSensitive={toggleCaseSensitive}
          caseSensitive={caseSensitive}
          stopFind={stopFind}
          onDismiss={onDismiss}
        />
      </div>
      <div className='flex flex-nowrap gap-1'>
        <ReplaceInput replacement={replacement} setReplacement={setReplacement} />
        <ReplaceController replace={replace} replaceAll={replaceAll} />
      </div>
    </div>
  )
}
