import { type FC } from 'react'
import type { EditorContext } from 'rme'
import { FindController } from './find-controller'
import { FindInput } from './find-input'
import { ReplaceController } from './replace-controller'
import { ReplaceInput } from './replace-input'
import { useFindReplace } from './use-find-replace'

export interface FindReplaceComponentProps {
  onDismiss?: () => void
  editorCtx: EditorContext
}

export const FindReplaceComponent: FC<FindReplaceComponentProps> = ({ onDismiss, editorCtx }) => {
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
  } = useFindReplace(editorCtx)

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
