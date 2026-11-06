import { Button } from '@/components/ui/button'
import {
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/i18n'
import type { ExplorerSortDirection } from '@/stores/useExplorerStateStore'
import { ArrowDownAZIcon, ArrowUpAZIcon, CheckIcon } from 'lucide-react'

export interface ExplorerSortMenuProps {
  direction: ExplorerSortDirection
  onDirectionChange: (direction: ExplorerSortDirection) => void
}

export function ExplorerSortMenu({ direction, onDirectionChange }: ExplorerSortMenuProps) {
  const { t } = useTranslation()
  const Icon = direction === 'asc' ? ArrowDownAZIcon : ArrowUpAZIcon
  const label = t('explorer.sort')
  return (
    <DropdownMenuRoot>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={label}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              size='icon-chrome'
              variant='chrome'
            >
              <Icon aria-hidden='true' size={14} strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{`${label}: ${t(`explorer.sort_name_${direction}`)}`}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align='end'
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuRadioGroup
          value={direction}
          onValueChange={(value) => {
            if (value === 'asc' || value === 'desc') onDirectionChange(value)
          }}
        >
          {(['asc', 'desc'] as const).map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <span aria-hidden='true' className='flex size-3.5 shrink-0 items-center justify-center'>
                {direction === value ? <CheckIcon size={14} strokeWidth={1.75} /> : null}
              </span>
              {t(`explorer.sort_name_${value}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  )
}
