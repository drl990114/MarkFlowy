import {
  aiProviderRegistry,
  normalizeAIProviderId,
  parseConfiguredModels,
} from '@/extensions/ai/aiProvidersService'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { useMemo } from 'react'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import InputSettingItem from '../component/SettingItems/Input'
import SelectSettingItem from '../component/SettingItems/Select'
import SwitchSettingItem from '../component/SettingItems/Switch'
import { getSettingMap } from '../settingMap'

export const CopilotSetting = () => {
  const settingMap = getSettingMap()
  const { settingData } = useAppSettingStore()

  // Copilot config definition from settingMap
  const copilotConfig = (settingMap as any).copilot

  // Get current provider models
  const providerId = normalizeAIProviderId(settingData['copilot_provider'])
  const currentProviderModels = useMemo(() => {
    if (!providerId || providerId === 'ollama') return []

    return parseConfiguredModels(
      settingData[aiProviderRegistry[providerId].settingKeys.models],
    ).map((m) => ({ value: m, title: m }))
  }, [
    providerId,
    settingData['extensions_chatgpt_models'],
    settingData['extensions_deepseek_models'],
    settingData['extensions_google_models'],
  ])

  return (
    <SettingGroupContainer>
      <SwitchSettingItem item={copilotConfig.enable} />

      <SelectSettingItem item={copilotConfig.provider} />

      {providerId === 'ollama' ? (
        <InputSettingItem
          item={{
            ...copilotConfig.model,
            type: 'input',
          }}
        />
      ) : (
        <SelectSettingItem
          item={{
            ...copilotConfig.model,
            options: currentProviderModels,
          }}
        />
      )}
    </SettingGroupContainer>
  )
}
