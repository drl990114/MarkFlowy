import {
  aiProviderRegistry,
  normalizeAIProviderId,
  parseConfiguredModels,
} from '@/extensions/ai/aiProvidersService'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { useMemo } from 'react'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import SelectSettingItem from '../component/SettingItems/Select'
import SwitchSettingItem from '../component/SettingItems/Switch'
import { getSettingMap } from '../settingMap'

export const CopilotSetting = () => {
  const settingMap = getSettingMap()
  const { settingData } = useAppSettingStore()

  // Copilot config definition from settingMap
  const copilotConfig = (settingMap as any).copilot

  // Get current provider models
  const providerId = normalizeAIProviderId(settingData.copilot_provider)
  const providerModels = providerId
    ? settingData[aiProviderRegistry[providerId].settingKeys.models]
    : undefined
  const currentProviderModels = useMemo(() => {
    if (!providerId) return []

    return parseConfiguredModels(providerModels).map((model) => ({
      value: model,
      title: model,
    }))
  }, [providerId, providerModels])

  return (
    <SettingGroupContainer>
      <SwitchSettingItem item={copilotConfig.enable} />

      <SelectSettingItem item={copilotConfig.provider} />

      <SelectSettingItem
        item={{
          ...copilotConfig.model,
          options: currentProviderModels,
        }}
      />
    </SettingGroupContainer>
  )
}
