import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { MfTheme } from '@markflowy/theme'
import { Download, LoaderCircle, Moon, RefreshCw, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toAppTheme } from '@/themes/runtime'
import { communityThemeQueryOptions, type ThemeItem } from './communityThemes'
import { ThemePalette } from './ThemeListItem'
import { useThemeLabels } from './labels'

export interface CommunityThemeItemProps {
  item: ThemeItem
  mode: MfTheme['mode']
  pending: boolean
  selectOnInstall?: boolean
  onInstall: () => void
}

export function CommunityThemeItem({
  item,
  mode,
  pending,
  selectOnInstall,
  onInstall,
}: CommunityThemeItemProps) {
  const labels = useThemeLabels()
  const query = useQuery(communityThemeQueryOptions(item))
  const preview = useMemo(() => {
    if (!query.data) return undefined
    const variant =
      query.data.variants.find((entry) => entry.mode === mode) ?? query.data.variants[0]
    return toAppTheme(query.data, variant)
  }, [query.data, mode])
  const ModeIcon = preview?.mode === 'dark' ? Moon : Sun
  const incompatible = Boolean(selectOnInstall && preview && preview.mode !== mode)
  return (
    <article
      aria-label={item.name}
      className='flex flex-wrap items-center gap-3 rounded-md px-2 py-2'
    >
      {preview ? (
        <ThemePalette theme={preview} />
      ) : (
        <div className='flex h-12 w-20 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground'>
          {query.isError ? (
            <Button
              size='sm'
              variant='ghost'
              aria-label={`${labels.retryPreview}: ${item.name}`}
              disabled={query.isFetching || pending}
              onClick={() => void query.refetch()}
            >
              <RefreshCw aria-hidden className='size-3.5' />
              {labels.retry}
            </Button>
          ) : (
            <span role='status' aria-label={labels.loadingPreview}>
              <LoaderCircle
                aria-hidden
                className='size-4 animate-spin motion-reduce:animate-none'
              />
            </span>
          )}
        </div>
      )}
      <div className='min-w-0 flex-1 basis-32'>
        <div className='break-words font-medium'>{item.name}</div>
        <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-caption text-muted-foreground'>
          {preview && (
            <span className='inline-flex items-center gap-1'>
              <ModeIcon aria-hidden className='size-3' />
              {labels[preview.mode]}
            </span>
          )}
          <span className='break-words'>
            {labels.author}: {item.author} · v{item.version}
          </span>
        </div>
      </div>
      <Button size='sm' variant='outline' disabled={pending || incompatible} onClick={onInstall}>
        <Download aria-hidden className='size-3.5' />
        {incompatible
          ? labels[mode === 'light' ? 'noLightVariant' : 'noDarkVariant']
          : selectOnInstall
            ? labels.installAndSelect
            : labels.install}
      </Button>
    </article>
  )
}
