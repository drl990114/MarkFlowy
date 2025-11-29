import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { debounce } from 'lodash'
import { nanoid } from 'nanoid'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

interface KeyValuePair {
  id: string
  key: string
  value: string
}

const StringMapJsonSettingItem: React.FC<SettingItemProps<Setting.StringMapJsonSettingItem>> = (
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const { t } = useTranslation()

  const curValue = (settingData[item.key] as unknown as Record<string, string>) || {}

  const [pairs, setPairs] = useState<KeyValuePair[]>(() => {
    return Object.entries(curValue).map(([key, value]) => ({
      id: nanoid(),
      key,
      value,
    }))
  })

  const updateSetting = useCallback(
    debounce((newPairs: KeyValuePair[]) => {
      const newValue: Record<string, string> = {}
      newPairs.forEach(({ key, value }) => {
        if (key.trim()) {
          newValue[key.trim()] = value.trim()
        }
      })
      appSettingService.writeSettingData(item, newValue)
    }, 1000),
    [item],
  )

  const handleAddPair = useCallback(() => {
    const newPairs = [...pairs, { id: nanoid(), key: '', value: '' }]
    setPairs(newPairs)
  }, [pairs])

  const handleKeyChange = useCallback(
    (id: string, newKey: string) => {
      const newPairs = pairs.map((pair) => (pair.id === id ? { ...pair, key: newKey } : pair))
      setPairs(newPairs)
      updateSetting(newPairs)
    },
    [pairs, updateSetting],
  )

  const handleValueChange = useCallback(
    (id: string, newValue: string) => {
      const newPairs = pairs.map((pair) => (pair.id === id ? { ...pair, value: newValue } : pair))
      setPairs(newPairs)
      updateSetting(newPairs)
    },
    [pairs, updateSetting],
  )

  const handleDeletePair = useCallback(
    (id: string) => {
      const newPairs = pairs.filter((pair) => pair.id !== id)
      setPairs(newPairs)
      updateSetting(newPairs)
    },
    [pairs, updateSetting],
  )

  return (
    <SettingItemContainer $direction='column'>
      <SettingLabel item={item} style={{ marginBottom: '8px' }} />
      <ContentContainer>
        <PairsContainer>
          {pairs.map((pair) => (
            <PairRow key={pair.id}>
              <Input
                placeholder={t('common.key')}
                value={pair.key}
                onChange={(e) => handleKeyChange(pair.id, e.target.value)}
              />
              <Input
                placeholder={t('common.value')}
                value={pair.value}
                onChange={(e) => handleValueChange(pair.id, e.target.value)}
              />
              <DeleteButton onClick={() => handleDeletePair(pair.id)}>
                <i className='ri-delete-bin-line'></i>
              </DeleteButton>
            </PairRow>
          ))}
        </PairsContainer>
        <AddButton onClick={handleAddPair}>
          <i className='ri-add-line'></i>
         {t(item.i18nProps.add)}
        </AddButton>
      </ContentContainer>
    </SettingItemContainer>
  )
}

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 300px;
`

const PairsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const PairRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`

const Input = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background-color: ${({ theme }) => theme.bgColor};
  color: ${({ theme }) => theme.primaryFontColor};
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.accentColor};
  }

  &::placeholder {
    color: ${({ theme }) => theme.labelFontColor};
  }
`

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background-color: transparent;
  color: ${({ theme }) => theme.primaryFontColor};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.hoverColor};
    border-color: ${({ theme }) => theme.accentColor};
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

export default StringMapJsonSettingItem
