import { useMemo, type ReactNode } from 'react'
import type { MfTheme } from '@markflowy/theme'
import { Check, Copy, Download, Ellipsis, Moon, Pencil, Sun, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuContent,
  DropdownMenuItemPrimitive as MenuItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { getThemeTokens, themeLabel } from '@/themes/runtime'
import { useThemeLabels } from './labels'

export interface ThemeMenuProps {
  label: string
  disabled?: boolean
  trigger?: ReactNode
  children: ReactNode
}

export function ThemeMenu({ label, disabled, trigger, children }: ThemeMenuProps) {
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button
          size={trigger ? 'sm' : 'icon-sm'}
          variant={trigger ? 'outline' : 'ghost'}
          disabled={disabled}
          aria-label={label}
        >
          {trigger ?? <Ellipsis aria-hidden className='size-4' />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>{children}</DropdownMenuContent>
    </DropdownMenuRoot>
  )
}

export function ThemePalette({ theme }: { theme: MfTheme }) {
  const tokens = useMemo(() => getThemeTokens(theme), [theme])
  return (
    <svg
      aria-hidden
      data-slot='theme-palette'
      viewBox='0 0 80 48'
      className='h-12 w-20 shrink-0 overflow-hidden rounded-sm border border-border'
    >
      <rect width='80' height='48' fill={tokens['editor.background']} />
      <rect width='21' height='48' fill={tokens['chrome.sidebar.background']} />
      <rect width='80' height='7' fill={tokens['chrome.titlebar.background']} />
      <rect x='5' y='13' width='11' height='3' rx='1' fill={tokens['accent.background']} />
      <rect x='5' y='21' width='8' height='2' rx='1' fill={tokens['text.secondary']} opacity='.5' />
      <rect
        x='5'
        y='27'
        width='10'
        height='2'
        rx='1'
        fill={tokens['text.secondary']}
        opacity='.5'
      />
      <rect x='28' y='14' width='26' height='4' rx='1' fill={tokens['editor.foreground']} />
      <rect x='28' y='24' width='43' height='2' rx='1' fill={tokens['editor.muted']} opacity='.6' />
      <rect x='28' y='30' width='35' height='2' rx='1' fill={tokens['editor.muted']} opacity='.6' />
      <rect x='28' y='36' width='20' height='2' rx='1' fill={tokens['accent.background']} />
    </svg>
  )
}

export interface ThemeListItemProps {
  theme: MfTheme
  current: boolean
  selected?: boolean
  pending: boolean
  author?: string
  installed?: boolean
  onApply: () => void
  onCopy: () => void
  onEdit?: () => void
  onExport?: () => void
  onReinstall?: () => void
  onRemove?: () => void
}

export function ThemeListItem({
  theme,
  current,
  selected,
  pending,
  author,
  installed,
  onApply,
  onCopy,
  onEdit,
  onExport,
  onReinstall,
  onRemove,
}: ThemeListItemProps) {
  const labels = useThemeLabels()
  const name = themeLabel(theme)
  const ModeIcon = theme.mode === 'light' ? Sun : Moon
  return (
    <article
      aria-label={name}
      aria-current={current ? 'true' : undefined}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-2 py-2',
        current && 'bg-muted',
      )}
    >
      <ThemePalette theme={theme} />
      <div className='min-w-0 flex-1 basis-32'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='break-words font-medium'>{name}</span>
          {installed && !current && <Badge size='sm'>{labels.installed}</Badge>}
        </div>
        <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-caption text-muted-foreground'>
          <span className='inline-flex items-center gap-1'>
            <ModeIcon aria-hidden className='size-3' />
            {labels[theme.mode]}
          </span>
          {author !== undefined && (
            <span className='break-words'>
              {author ? `${labels.author}: ${author}` : labels.unknownAuthor}
            </span>
          )}
        </div>
      </div>
      <div className='ml-auto flex shrink-0 items-center gap-1'>
        {(selected ?? current) ? (
          <span className='inline-flex h-7 items-center gap-1 px-2 text-ui-caption text-primary'>
            <Check aria-hidden className='size-3.5' />
            {current ? labels.active : labels.selected}
          </span>
        ) : (
          <Button size='sm' variant='outline' disabled={pending} onClick={onApply}>
            {labels[theme.mode === 'light' ? 'setLight' : 'setDark']}
          </Button>
        )}
        <ThemeMenu label={`${labels.more}: ${name}`} disabled={pending}>
          <MenuItem onSelect={onCopy}>
            <Copy aria-hidden className='size-3.5' />
            {labels.copy}
          </MenuItem>
          {onEdit && (
            <MenuItem onSelect={onEdit}>
              <Pencil aria-hidden className='size-3.5' />
              {labels.edit}
            </MenuItem>
          )}
          {onExport && (
            <MenuItem onSelect={onExport}>
              <Download aria-hidden className='size-3.5' />
              {labels.export}
            </MenuItem>
          )}
          {onReinstall && (
            <MenuItem onSelect={onReinstall}>
              <Download aria-hidden className='size-3.5' />
              {labels.reinstall}
            </MenuItem>
          )}
          {onRemove && (
            <>
              <DropdownMenuSeparator />
              <MenuItem className='text-destructive' onSelect={onRemove}>
                <Trash2 aria-hidden className='size-3.5' />
                {labels.remove}
              </MenuItem>
            </>
          )}
        </ThemeMenu>
      </div>
    </article>
  )
}
