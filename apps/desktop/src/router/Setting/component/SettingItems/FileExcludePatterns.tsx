import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import {
  parseFileExcludePatternLines,
  stringifyFileExcludePatternLines,
} from '@/helper/file-exclude'
import { Input } from 'antd'
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
            size='small'
            value={editingValue}
            placeholder={placeholder || 'Enter value...'}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleCommit}
            style={{ fontFamily: 'monospace' }}
          />
        ) : (
          <>
            <RowText>{value}</RowText>
            <RowActions className='row-actions'>
              <IconButton
                aria-label='Edit item'
                onClick={() => {
                  setEditingValue(value)
                  setIsEditing(true)
                }}
              >
                <i className='ri-pencil-line' />
              </IconButton>
              <IconButton aria-label='Delete item' onClick={onDelete}>
                <i className='ri-close-line' />
              </IconButton>
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
          handleCancel()
        }
      },
      [handleCancel],
    )

    return (
      <RowWrapper>
        <Input
          autoFocus
          size='small'
          value={addValue}
          placeholder={placeholder || 'Enter value...'}
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
    <SettingItemContainer $direction='column'>
      <SettingLabel item={item} style={{ marginBottom: '8px' }} />
      <ContainerWrapper>
        <ListWrapper>
          {items.length === 0 && !adding && <EmptyHint>{t('common.none')}</EmptyHint>}

          {items.map((listItem) => (
            <FileExcludeRowItem
              key={listItem.id}
              value={listItem.value}
              placeholder={item.placeholder}
              onSave={(newValue) => handleItemSave(listItem.id, newValue)}
              onDelete={() => handleItemDelete(listItem.id)}
            />
          ))}

          {adding && (
            <AddingExcludeRowItem
              placeholder={item.placeholder}
              onSave={handleAddSave}
              onCancel={() => setAdding(false)}
            />
          )}
        </ListWrapper>

        {!adding && (
          <AddButton onClick={() => setAdding(true)}>
            <i className='ri-add-line' />
            {t(item.i18nProps?.add || 'common.addPattern')}
          </AddButton>
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
  min-height: 48px;
  margin-bottom: 8px;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 6px;
  background: ${({ theme }) => theme.bgColorSecondary};
`

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
`

const RowWrapper = styled.div`
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: 0 8px;
  color: ${({ theme }) => theme.primaryFontColor};

  &:hover,
  &:focus-within {
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
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const EmptyHint = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  color: ${({ theme }) => theme.labelFontColor};
  font-size: 13px;
`

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: ${({ theme }) => theme.labelFontColor};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.bgColor};
    color: ${({ theme }) => theme.accentColor};
  }

  i {
    font-size: 14px;
  }
`

const AddButton = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px dashed ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background-color: transparent;
  color: ${({ theme }) => theme.primaryFontColor};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;

  &:hover {
    background-color: ${({ theme }) => theme.hoverColor};
    border-color: ${({ theme }) => theme.accentColor};
    color: ${({ theme }) => theme.accentColor};
  }

  i {
    font-size: 14px;
  }
`

export default FileExcludePatternsSettingItem
