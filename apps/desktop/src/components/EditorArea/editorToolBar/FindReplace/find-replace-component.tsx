import { type FC } from 'react'
import type { EditorContext } from 'rme'
import type { CapricornRuntimeAdapter } from '../../capricornRuntimeAdapter'
import { FindController } from './find-controller'
import { FindInput } from './find-input'
import { ReplaceController } from './replace-controller'
import { ReplaceInput } from './replace-input'
import { useFindReplace } from './use-find-replace'
import { useCapricornFindReplace } from './use-capricorn-find-replace'
import type { useEditorSearchController } from './use-editor-search'

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
  controller: (
    | ReturnType<typeof useFindReplace>
    | ReturnType<typeof useCapricornFindReplace>
    | ReturnType<typeof useEditorSearchController>
  ) & { setComposing?: (value: boolean) => void }
  onDismiss?: () => void
}

export function FindReplaceControls({ controller, onDismiss }: FindReplaceControlsProps) {
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
    <div
      className='flex flex-col gap-2'
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Escape') {
          event.preventDefault()
          stopFind()
          onDismiss?.()
        } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault()
          if (event.target.hasAttribute('data-mf-replace-input')) replace()
          else if (event.shiftKey) findPrev()
          else findNext()
        }
      }}
    >
      <div className='flex flex-nowrap gap-1'>
        <FindInput
          query={query}
          setQuery={setQuery}
          total={total}
          activeIndex={activeIndex}
          setComposing={controller.setComposing}
        />
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
