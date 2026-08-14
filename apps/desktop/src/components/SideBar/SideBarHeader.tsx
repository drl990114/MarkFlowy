import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ReactNode } from 'react'
import styled from 'styled-components'

export interface RightNavItem {
  iconCls: string
  key: React.Key
  tooltip?: {
    title: ReactNode
  }
}

export interface SideBarHeaderProps {
  actions?: ReactNode
  name: ReactNode
  onRightNavItemClick?: (item: RightNavItem) => void
  rightNavItems?: RightNavItem[]
}

const Container = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 32px;
  padding: 0 6px 0 8px;
  border-bottom: 1px solid var(--mf-ui-border-subtle);
  color: ${(props) => props.theme.primaryFontColor};
  background-color: ${(props) => props.theme.sideBarHeaderBgColor};
  box-sizing: border-box;

  .mf-sidebar-header__name {
    min-width: 0;
    overflow: hidden;
    color: ${(props) => props.theme.unselectedFontColor};
    font-size: var(--mf-ui-font-caption);
    font-weight: 500;
    line-height: var(--mf-ui-line-height-caption);
    letter-spacing: var(--mf-ui-tracking-caption);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mf-sidebar-header__actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 2px;
  }
`

export default function SideBarHeader(props: SideBarHeaderProps) {
  const { actions, name, onRightNavItemClick, rightNavItems } = props

  return (
    <Container>
      <span className='mf-sidebar-header__name'>{name}</span>
      <div className='mf-sidebar-header__actions'>
        {actions}
        {rightNavItems?.map((item) => {
          const button = (
            <Button
              aria-label={
                typeof item.tooltip?.title === 'string' ? item.tooltip.title : String(item.key)
              }
              className='size-6 rounded-sm text-foreground-secondary'
              onClick={() => onRightNavItemClick?.(item)}
              size='icon-sm'
              variant='ghost'
            >
              <i aria-hidden='true' className={item.iconCls} />
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
