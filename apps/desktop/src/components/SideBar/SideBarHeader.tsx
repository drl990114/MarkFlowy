import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'
import type { Key, ReactNode } from 'react'
import styled from 'styled-components'

export interface RightNavItem {
  icon: LucideIcon
  key: Key
  tooltip?: {
    title: ReactNode
  }
}

export interface SideBarHeaderProps {
  actions?: ReactNode
  name: string
  onRightNavItemClick?: (item: RightNavItem) => void
  rightNavItems?: RightNavItem[]
}

const Container = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 32px;
  padding: 0 4px;
  border-bottom: 1px solid var(--mf-ui-border-subtle);
  color: ${(props) => props.theme.primaryFontColor};
  background-color: var(--mf-surface-panel-right, ${(props) => props.theme.rightBarHeaderBgColor});
  box-sizing: border-box;

  .mf-sidebar-header__actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
  }
`

export default function SideBarHeader(props: SideBarHeaderProps) {
  const { actions, name, onRightNavItemClick, rightNavItems } = props

  return (
    <Container aria-label={name} data-slot='dock-toolbar' role='toolbar'>
      <div className='mf-sidebar-header__actions'>
        {actions}
        {rightNavItems?.map((item) => {
          const Icon = item.icon
          const button = (
            <Button
              aria-label={
                typeof item.tooltip?.title === 'string' ? item.tooltip.title : String(item.key)
              }
              onClick={() => onRightNavItemClick?.(item)}
              size='icon-chrome'
              variant='chrome'
            >
              <Icon aria-hidden='true' strokeWidth={1.75} />
            </Button>
          )

          if (!item.tooltip) return <span key={item.key}>{button}</span>

          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent>{item.tooltip.title}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </Container>
  )
}
