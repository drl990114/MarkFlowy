import { useEditorStore } from '@/stores'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import { Popover } from '@/components/ui/popover'
import { RadioGroup } from '@/components/ui/radio-group'
import { useState } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import { StatusBarButton } from './StatusBarButton'

const PopoverContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
`

const PopoverTitle = styled.div`
  font-size: var(--mf-ui-font-caption);
  line-height: var(--mf-ui-line-height-caption);
  letter-spacing: var(--mf-ui-tracking-caption);
  color: ${(props) => props.theme.labelFontColor};
  margin-bottom: 4px;
`

const RadioOption = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`

type DisplayMode = 'words' | 'chars' | 'pureChars'

export const EditorCount = () => {
  const { t } = useTranslation()
  const { editorCounterMap } = useEditorCounterStore()
  const { activeId } = useEditorStore()
  const [popoverVisible, setPopoverVisible] = useState(false)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('chars')

  if (!activeId) {
    return null
  }

  const counter = editorCounterMap[activeId]

  if (!counter) {
    return null
  }

  const { wordCount, characterCount, nonWhitespaceCharacterCount } = counter

  const displayParts: string[] = []
  if (displayMode === 'words') {
    displayParts.push(`${wordCount} ${t('statusBar.words')}`)
  }
  if (displayMode === 'chars') {
    displayParts.push(`${characterCount} ${t('statusBar.chars')}`)
  }
  if (displayMode === 'pureChars') {
    displayParts.push(`${nonWhitespaceCharacterCount} ${t('statusBar.pureChars')}`)
  }

  if (displayParts.length === 0) {
    return null
  }

  const handleDisplayModeChange = (value: string) => {
    if (value === 'words' || value === 'chars' || value === 'pureChars') {
      setDisplayMode(value)
    }
  }

  return (
    <Popover.Root open={popoverVisible} onOpenChange={setPopoverVisible}>
      <Popover.Trigger asChild>
        <StatusBarButton
          aria-label={`${displayParts.join(' ')}, ${t('statusBar.displaySettings')}`}
        >
          <span>{displayParts.join(' ')}</span>
        </StatusBarButton>
      </Popover.Trigger>
      <Popover.Content side='top' align='end'>
        <PopoverContent>
          <PopoverTitle>{t('statusBar.displaySettings')}</PopoverTitle>
          <RadioGroup.Root
            aria-label={t('statusBar.displaySettings')}
            value={displayMode}
            onValueChange={handleDisplayModeChange}
          >
            <RadioOption>
              <RadioGroup.Item value='words' />
              {t('statusBar.words')}
            </RadioOption>
            <RadioOption>
              <RadioGroup.Item value='chars' />
              {t('statusBar.chars')}
            </RadioOption>
            <RadioOption>
              <RadioGroup.Item value='pureChars' />
              {t('statusBar.pureCharsOption')}
            </RadioOption>
          </RadioGroup.Root>
        </PopoverContent>
      </Popover.Content>
    </Popover.Root>
  )
}
