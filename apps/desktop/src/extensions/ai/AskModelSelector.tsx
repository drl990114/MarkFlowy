import { commandRegistry } from '@/commands'
import { EVENT } from '@/constants'
import { useTranslation } from '@/i18n'
import { ArrowRightIcon, Settings2Icon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DotMatrix } from './components/assistant-ui/dot-matrix'
import { Button } from '@/components/ui/button'
import { ModelSelector, type ModelOption } from './components/assistant-ui/model-selector'
import { aiProviderRegistry, parseAIModelKey } from './aiProvidersService'
import type { AIModelDescriptor, AIModelKey, AIProviderId } from './aiProvidersService'
import type { useAskModelCatalog } from './useAskModelCatalog'

export type AskModelCatalogState = ReturnType<typeof useAskModelCatalog>

const openProviderSettings = (providerId?: AIProviderId) => {
  commandRegistry.execute(EVENT.app_openSetting, { category: 'ai', providerId })
}

export function AskModelSelector({
  disabled,
  modelState,
}: {
  disabled: boolean
  modelState: AskModelCatalogState
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { catalog, selectedModelKey, selectModel, isRefreshingOllama, handleSelectorOpenChange } =
    modelState

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const options = useMemo<ModelOption[]>(
    () =>
      catalog.models.flatMap((model) =>
        model.status === 'ready'
          ? [
              {
                id: model.key,
                name: model.modelId,
                keywords: [model.providerId, aiProviderRegistry[model.providerId].displayName],
              },
            ]
          : [],
      ),
    [catalog.models],
  )

  return (
    <ModelSelector.Root
      models={options}
      onOpenChange={(nextOpen) => {
        if (disabled) return
        setOpen(nextOpen)
        handleSelectorOpenChange(nextOpen)
      }}
      onValueChange={(value) => {
        if (!disabled && parseAIModelKey(value)) selectModel(value as AIModelKey)
      }}
      open={open}
      value={selectedModelKey}
    >
      <ModelSelector.Trigger className='h-7 max-w-44' disabled={disabled} size='sm' variant='ghost'>
        <ModelSelector.Value placeholder={t('ai.select_model')} />
      </ModelSelector.Trigger>
      <ModelSelector.Content align='start' className='w-[17.5rem] max-w-[calc(100vw-1rem)]'>
        <ModelSelector.Search
          placeholder={t('ai.search_models')}
          wrapperClassName={options.length > 6 ? undefined : 'sr-only'}
        />
        <ModelSelector.List>
          <ModelSelector.Empty>
            <div className='flex items-center justify-center gap-2'>
              {isRefreshingOllama ? (
                <DotMatrix
                  className='size-3.5 text-primary'
                  label={t('ai.ollama_connecting')}
                  state='loading'
                />
              ) : null}
              <span>
                {options.length === 0 ? t('ai.no_models_configured') : t('ai.no_models_found')}
              </span>
            </div>
          </ModelSelector.Empty>
          {catalog.configuredProviderIds.map((providerId, index) => (
            <ProviderModelGroup
              key={providerId}
              disabled={disabled}
              models={catalog.modelsByProvider[providerId].filter(
                (model) => model.status === 'ready',
              )}
              providerId={providerId}
              showSeparator={index > 0}
            />
          ))}
        </ModelSelector.List>
        <ModelSelector.Footer>
          <Button
            className='h-7 w-full justify-between px-2 text-xs font-normal'
            disabled={disabled}
            onClick={() => {
              setOpen(false)
              openProviderSettings()
            }}
            type='button'
            variant='ghost'
          >
            <Settings2Icon className='size-3.5' />
            <span className='min-w-0 flex-1 truncate text-start'>{t('ai.manage_providers')}</span>
            <ArrowRightIcon className='size-3 text-muted-foreground' />
          </Button>
        </ModelSelector.Footer>
      </ModelSelector.Content>
    </ModelSelector.Root>
  )
}

function ProviderModelGroup({
  disabled,
  providerId,
  models,
  showSeparator,
}: {
  disabled: boolean
  providerId: AIProviderId
  models: AIModelDescriptor[]
  showSeparator: boolean
}) {
  const provider = aiProviderRegistry[providerId]

  return (
    <>
      {showSeparator ? <ModelSelector.Separator /> : null}
      <ModelSelector.Group heading={provider.displayName}>
        {models.map((model) => (
          <ModelSelector.Item
            key={model.key}
            model={{
              id: model.key,
              name: model.modelId,
              disabled,
              keywords: [providerId, provider.displayName],
            }}
          />
        ))}
      </ModelSelector.Group>
    </>
  )
}
