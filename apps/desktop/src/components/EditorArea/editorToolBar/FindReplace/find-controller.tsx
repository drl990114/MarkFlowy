import {
  CaseSensitiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from 'lucide-react'
import type { FC } from 'react'
import { EditorAreaActionButton } from '../../EditorAreaAction'

export const FindController: FC<{
  findPrev: () => void
  findNext: () => void
  stopFind: () => void
  caseSensitive: boolean
  toggleCaseSensitive: () => void
  onDismiss?: () => void
}> = ({ findPrev, findNext, stopFind, caseSensitive, toggleCaseSensitive, onDismiss }) => (
  <div className='flex items-center gap-1'>
    <EditorAreaActionButton
      icon={ChevronLeftIcon}
      label='Find previous match'
      onClick={findPrev}
    />
    <EditorAreaActionButton
      icon={ChevronRightIcon}
      label='Find next match'
      onClick={findNext}
    />
    <EditorAreaActionButton
      aria-pressed={caseSensitive}
      icon={CaseSensitiveIcon}
      label='Match case'
      onClick={toggleCaseSensitive}
    />
    <EditorAreaActionButton
      icon={XIcon}
      label='Close find and replace'
      onClick={() => {
        stopFind()
        onDismiss?.()
      }}
    />
  </div>
)
