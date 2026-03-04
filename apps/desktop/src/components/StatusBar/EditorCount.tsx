import { useEditorStore } from '@/stores'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import { Popover, Radio } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const Container = styled.div`
  padding: 8px 12px 8px 8px;
  z-index: 2;
  opacity: 0.8;
  font-size: 0.85rem;
  user-select: none;
  box-sizing: border-box;
  cursor: default;
  background-color: ${(props) => props.theme.statusBarBgColor};
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
`

const PopoverContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
`

const PopoverTitle = styled.div`
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 4px;
`

export const EditorCount = () => {
  const { t } = useTranslation()
  const { editorCounterMap } = useEditorCounterStore()
  const { activeId } = useEditorStore()
  const [popoverVisible, setPopoverVisible] = useState(false)
  const [displayMode, setDisplayMode] = useState<'words' | 'chars'>('chars')

  if (!activeId) {
    return null
  }

  const counter = editorCounterMap[activeId]

  if (!counter) {
    return null
  }

  const { wordCount, characterCount } = counter

  const displayParts: string[] = []
  if (displayMode === 'words') {
    displayParts.push(`${wordCount} ${t('statusBar.words')}`)
  }
  if (displayMode === 'chars') {
    displayParts.push(`${characterCount} ${t('statusBar.chars')}`)
  }

  if (displayParts.length === 0) {
    return null
  }

  const popoverContent = (
    <PopoverContent>
      <PopoverTitle>{t('statusBar.displaySettings')}</PopoverTitle>
      <Radio.Group
        value={displayMode}
        onChange={(e) => setDisplayMode(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <Radio value='words'>{t('statusBar.words')}</Radio>
        <Radio value='chars'>{t('statusBar.chars')}</Radio>
      </Radio.Group>
    </PopoverContent>
  )

  return (
    <Popover
      content={popoverContent}
      trigger='click'
      open={popoverVisible}
      onOpenChange={setPopoverVisible}
      placement='topRight'
    >
      <Container>
        <span style={{ opacity: 0.8, cursor: 'pointer' }}>{displayParts.join(' ')}</span>
      </Container>
    </Popover>
  )
}
