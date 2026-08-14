import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ReactNode } from 'react'

interface SideBarModeButtonProps {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}

export function SideBarModeButton(props: SideBarModeButtonProps) {
  const { active, icon, label, onClick } = props

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={active}
          className='app-sidebar__item'
          onClick={onClick}
          size='icon-sm'
          variant='ghost'
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
