import {
  CaseSensitiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from '@/i18n'
import { EditorAreaActionButton } from '../../EditorAreaAction'

export const FindController: FC<{
  findPrev: () => void
  findNext: () => void
  stopFind: () => void
  caseSensitive: boolean
  toggleCaseSensitive: () => void
  onDismiss?: () => void
}> = ({ findPrev, findNext, stopFind, caseSensitive, toggleCaseSensitive, onDismiss }) => {
  const { t } = useTranslation()

  return (
    <div className='flex items-center gap-1'>
      <EditorAreaActionButton
        icon={ChevronLeftIcon}
        label={t('find_replace.previous_match')}
        onClick={findPrev}
      />
      <EditorAreaActionButton
        icon={ChevronRightIcon}
        label={t('find_replace.next_match')}
        onClick={findNext}
      />
      <EditorAreaActionButton
        aria-pressed={caseSensitive}
        icon={CaseSensitiveIcon}
        label={t('find_replace.match_case')}
        onClick={toggleCaseSensitive}
      />
      <EditorAreaActionButton
        icon={XIcon}
        label={t('find_replace.close')}
        onClick={() => {
          stopFind()
          onDismiss?.()
        }}
      />
    </div>
  )
}
