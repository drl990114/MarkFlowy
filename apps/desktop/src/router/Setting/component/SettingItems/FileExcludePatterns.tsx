import { Button } from '@/components/ui/button'
import { Pencil, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import {
  parseFileExcludePatternLines,
  stringifyFileExcludePatternLines,
} from '@/helper/file-exclude'
import { nanoid } from 'nanoid'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

interface ExcludeItem {
  id: string
  value: string
}

interface FileExcludeRowItemProps {
  value: string
  placeholder?: string
  onSave: (newValue: string) => void
  onDelete: () => void
}

const FileExcludeRowItem = memo<FileExcludeRowItemProps>(
  ({ value, placeholder, onSave, onDelete }) => {
    const { t } = useTranslation()
    const [isEditing, setIsEditing] = useState(false)
    const [editingValue, setEditingValue] = useState(value)
    const isCancelledRef = useRef(false)

    const handleCommit = useCallback(() => {
      if (isCancelledRef.current) {
        isCancelledRef.current = false
        return
      }
      const val = editingValue.trim()
      onSave(val)
      setIsEditing(false)
    }, [editingValue, onSave])

    const handleCancel = useCallback(() => {
      isCancelledRef.current = true
      setIsEditing(false)
      setEditingValue(value)
    }, [value])

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          handleCancel()
        }
      },
      [handleCancel],
    )

    return (
      <RowWrapper>
        {isEditing ? (
          <Input
            autoFocus
            data-mf-settings-escape-cancel=''
            inputSize='sm'
            value={editingValue}
            placeholder={placeholder || t('settings.value_placeholder')}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleCommit}
            style={{ fontFamily: 'monospace' }}
          />
        ) : (
          <>
            <RowText>{value}</RowText>
            <RowActions className='row-actions'>
              <Button variant='chrome' size='icon-sm' className='size-6'
                aria-label={t('settings.edit_item')}
                onClick={() => {
                  setEditingValue(value)
                  setIsEditing(true)
                }}
              >
                <Pencil aria-hidden className='size-3.5' />
              </Button>
              <Button variant='chrome' size='icon-sm' className='size-6' aria-label={t('settings.delete_item')} onClick={onDelete}>
                <X aria-hidden className='size-3.5' />
              </Button>
            </RowActions>
          </>
        )}
      </RowWrapper>
    )
  },
)

interface AddingExcludeRowItemProps {
  placeholder?: string
  onSave: (value: string) => void
  onCancel: () => void
}

const AddingExcludeRowItem = memo<AddingExcludeRowItemProps>(
  ({ placeholder, onSave, onCancel }) => {
    const { t } = useTranslation()
    const [addValue, setAddValue] = useState('')
    const isCancelledRef = useRef(false)

    const handleCommit = useCallback(() => {
      if (isCancelledRef.current) {
        isCancelledRef.current = false
        return
      }
      const val = addValue.trim()
      onSave(val)
    }, [addValue, onSave])

    const handleCancel = useCallback(() => {
      isCancelledRef.current = true
      onCancel()
    }, [onCancel])

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          handleCancel()
        }
      },
      [handleCancel],
    )

    return (
      <RowWrapper>
        <Input
          autoFocus
          data-mf-settings-escape-cancel=''
          inputSize='sm'
          value={addValue}
          placeholder={placeholder || t('settings.value_placeholder')}
          onChange={(e) => setAddValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleCommit}
          style={{ fontFamily: 'monospace' }}
        />
      </RowWrapper>
    )
  },
)

const FileExcludePatternsSettingItem: React.FC<
  SettingItemProps<Setting.FileExcludePatternsSettingItem>
> = memo((props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const { t } = useTranslation()
  const placeholder = item.placeholderI18nKey ? t(item.placeholderI18nKey) : item.placeholder
  const curValue = (settingData[item.key] as unknown as string) || ''

  const parsedLines = useMemo(() => parseFileExcludePatternLines(curValue), [curValue])
  const [items, setItems] = useState<ExcludeItem[]>(() =>
    parsedLines.map((value) => ({ id: nanoid(), value })),
  )
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setItems((prevItems) => {
      const prevValues = prevItems.map((i) => i.value)
      if (
        prevValues.length === parsedLines.length &&
        prevValues.every((val, index) => val === parsedLines[index])
      ) {
        return prevItems
      }
      return parsedLines.map((value) => {
        const matched = prevItems.find((i) => i.value === value)
        return { id: matched ? matched.id : nanoid(), value }
      })
    })
  }, [parsedLines])

  const writeItems = useCallback(
    (nextItems: ExcludeItem[]) => {
      setItems(nextItems)
      const value = stringifyFileExcludePatternLines(nextItems.map((i) => i.value))
      appSettingService.writeSettingData(item, value)
    },
    [item],
  )

  const handleItemSave = useCallback(
    (id: string, newValue: string) => {
      const nextItems = newValue
        ? items.map((i) => (i.id === id ? { ...i, value: newValue } : i))
        : items.filter((i) => i.id !== id)
      writeItems(nextItems)
    },
    [items, writeItems],
  )

  const handleItemDelete = useCallback(
    (id: string) => {
      writeItems(items.filter((i) => i.id !== id))
    },
    [items, writeItems],
  )

  const handleAddSave = useCallback(
    (newValue: string) => {
      if (newValue) {
        writeItems([...items, { id: nanoid(), value: newValue }])
      }
      setAdding(false)
    },
    [items, writeItems],
  )

  return (
    <SettingItemContainer $direction='column' $settingKey={item.key}>
      <SettingLabel item={item} />
      <ContainerWrapper>
        <ListWrapper>
          {items.length === 0 && !adding && <EmptyHint>{t('common.none')}</EmptyHint>}

          {items.map((listItem) => (
            <FileExcludeRowItem
              key={listItem.id}
              value={listItem.value}
              placeholder={placeholder}
              onSave={(newValue) => handleItemSave(listItem.id, newValue)}
              onDelete={() => handleItemDelete(listItem.id)}
            />
          ))}

          {adding && (
            <AddingExcludeRowItem
              placeholder={placeholder}
              onSave={handleAddSave}
              onCancel={() => setAdding(false)}
            />
          )}
        </ListWrapper>

        {!adding && (
          <Button variant='outline' size='sm' onClick={() => setAdding(true)}>
            <Plus aria-hidden className='size-3.5' />
            {t(item.i18nProps?.add || 'common.addPattern')}
          </Button>
        )}
      </ContainerWrapper>
    </SettingItemContainer>
  )
})

const ContainerWrapper = styled.div`
  width: 100%;
  max-width: 500px;
`

const ListWrapper = styled.div`
  width: 100%;
  min-height: 28px;
  margin-bottom: 8px;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background: transparent;
`

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--mf-motion-duration-fast) var(--mf-motion-ease-out);

  @media (hover: none) {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const RowWrapper = styled.div`
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 4px;
  color: ${({ theme }) => theme.primaryFontColor};

  &:hover {
    background: ${({ theme }) => theme.hoverColor};
  }

  &:hover .row-actions,
  &:focus-within .row-actions {
    opacity: 1;
  }
`

const RowText = styled.div`
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const EmptyHint = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  color: ${({ theme }) => theme.labelFontColor};
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
`

export default FileExcludePatternsSettingItem
