import useAppSettingStore from '@/stores/useAppSettingStore'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { buildAIModelCatalog, findAIModel, resolvePreferredAIModel } from './aiModelCatalog'
import { useAIModelPreference } from './aiModelPreference'
import { aiProviderRegistry, normalizeRequestHeaders } from './aiProvidersService'
import {
  discoverOllamaModels,
  getOllamaDiscoveryQueryKey,
  OLLAMA_DISCOVERY_STALE_TIME_MS,
  type OllamaDiscoveryStatus,
} from './ollamaDiscovery'

export function useAskModelCatalog() {
  const settings = useAppSettingStore((state) => state.settingData)
  const selectedModelKey = useAIModelPreference((state) => state.selectedModelKey)
  const setSelectedModelKey = useAIModelPreference((state) => state.setSelectedModelKey)
  const ollamaKeys = aiProviderRegistry.ollama.settingKeys
  const ollamaApiBase = settings[ollamaKeys.apibase]
  const ollamaHeaders = normalizeRequestHeaders(settings[ollamaKeys.requestHeaders ?? ''])
  const queryKey = getOllamaDiscoveryQueryKey(ollamaApiBase, ollamaHeaders)
  const ollamaQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      discoverOllamaModels({ apiBaseUrl: String(ollamaApiBase || ''), headers: ollamaHeaders, signal }),
    staleTime: OLLAMA_DISCOVERY_STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const ollamaStatus: OllamaDiscoveryStatus = ollamaQuery.isPending
    ? 'loading'
    : ollamaQuery.isError
      ? 'error'
      : 'success'
  const catalog = useMemo(
    () =>
      buildAIModelCatalog(settings, {
        ollamaModels: ollamaQuery.data?.models,
        ollamaStatus,
        selectedModelKey,
      }),
    [ollamaQuery.data?.models, ollamaStatus, selectedModelKey, settings],
  )

  useEffect(() => {
    const resolved = resolvePreferredAIModel(catalog, selectedModelKey, ollamaStatus)
    if (resolved !== selectedModelKey) setSelectedModelKey(resolved)
  }, [catalog, ollamaStatus, selectedModelKey, setSelectedModelKey])

  const handleSelectorOpenChange = useCallback(
    (open: boolean) => {
      if (open && ollamaQuery.isStale && !ollamaQuery.isFetching) {
        void ollamaQuery.refetch()
      }
    },
    [ollamaQuery],
  )

  return {
    catalog,
    selectedModelKey,
    selectedModel: findAIModel(catalog, selectedModelKey),
    selectModel: setSelectedModelKey,
    ollamaStatus,
    isRefreshingOllama: ollamaQuery.isFetching,
    refreshOllama: ollamaQuery.refetch,
    handleSelectorOpenChange,
  }
}
