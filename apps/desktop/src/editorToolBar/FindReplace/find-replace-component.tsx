import { Box } from '@mui/material'
import { type FC } from 'react'
import { FindController } from './find-controller'
import { FindInput } from './find-input'
import { ReplaceController } from './replace-controller'
import { ReplaceInput } from './replace-input'
import { useFindReplace } from './use-find-replace'
import type { EditorContext } from '@linebyline/editor'

export interface FindReplaceComponentProps {
  onDismiss?: () => void;
  editorCtx: EditorContext;
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
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr max-content',
        gridTemplateRows: '1fr 1fr',
        rowGap: 1,
        columnGap: 1,
        alignItems: 'center',
      }}
    >
      <Box>
        <FindInput query={query} setQuery={setQuery} total={total} activeIndex={activeIndex} />
      </Box>
      <Box sx={{ justifySelf: 'end' }}>
        <FindController
          findPrev={findPrev}
          findNext={findNext}
          toggleCaseSensitive={toggleCaseSensitive}
          caseSensitive={caseSensitive}
          stopFind={stopFind}
          onDismiss={onDismiss}
        />
      </Box>
      <Box>
        <ReplaceInput replacement={replacement} setReplacement={setReplacement} />
      </Box>
      <Box sx={{ justifySelf: 'end' }}>
        <ReplaceController replace={replace} replaceAll={replaceAll} />
      </Box>
    </Box>
  )
}
