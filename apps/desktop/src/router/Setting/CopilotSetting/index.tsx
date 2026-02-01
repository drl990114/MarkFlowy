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
  const currentProviderModels = useMemo(() => {
    const provider = settingData['copilot_provider']
    let modelsStr = ''

    switch (provider) {
      case 'ChatGPT':
        modelsStr = settingData['extensions_chatgpt_models'] || ''
        break
      case 'DeepSeek':
        modelsStr = settingData['extensions_deepseek_models'] || ''
        break
      case 'Ollama':
        modelsStr = settingData['extensions_ollama_models'] || ''
        break
      case 'Google':
        modelsStr = settingData['extensions_google_models'] || ''
        break
    }

    return modelsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((m) => ({ value: m, title: m }))
  }, [
    settingData['copilot_provider'],
    settingData['extensions_chatgpt_models'],
    settingData['extensions_deepseek_models'],
    settingData['extensions_ollama_models'],
    settingData['extensions_google_models'],
  ])

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
