import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { debounce } from 'lodash'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X } from 'lucide-react'
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

  const updateSetting = useMemo(
    () =>
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

  useEffect(() => () => updateSetting.flush(), [updateSetting])

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
    <SettingItemContainer $direction='column' $settingKey={item.key}>
      <SettingLabel item={item} />
      <div className='flex w-full min-w-0 max-w-[32rem] flex-col gap-2'>
        <div className='flex flex-col gap-1.5'>
          {pairs.map((pair, index) => (
            <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-2' key={pair.id}>
              <Input
                inputSize='sm'
                aria-label={`${t('common.key')} ${index + 1}`}
                placeholder={t('common.key')}
                value={pair.key}
                onChange={(e) => handleKeyChange(pair.id, e.target.value)}
              />
              <Input
                inputSize='sm'
                aria-label={`${t('common.value')} ${index + 1}`}
                placeholder={t('common.value')}
                value={pair.value}
                onChange={(e) => handleValueChange(pair.id, e.target.value)}
              />
              <Button variant='ghost' size='icon-sm' aria-label={`${t('settings.delete_item')} ${pair.key || index + 1}`} onClick={() => handleDeletePair(pair.id)}>
                <X aria-hidden className='size-3.5' />
              </Button>
            </div>
          ))}
        </div>
        <Button className='self-start' variant='outline' size='sm' onClick={handleAddPair}>
          <Plus aria-hidden className='size-3.5' />
          {t(item.i18nProps.add)}
        </Button>
      </div>
    </SettingItemContainer>
  )
}

export default StringMapJsonSettingItem
