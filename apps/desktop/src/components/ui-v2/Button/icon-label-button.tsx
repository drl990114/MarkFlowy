import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { TooltipContentProps } from '@/components/ui/tooltip'
import classNames from 'classnames'
import type { ReactNode } from 'react'
import styled from 'styled-components'

type MfTooltipProps = Omit<TooltipContentProps, 'children'> & {
  title: ReactNode
}

interface MfIconLabelButtonProps {
  icon: string
  label?: string
  className?: string
  onClick: (e?: React.MouseEvent<HTMLElement>) => void
  iconRef?: React.RefObject<any>
  tooltipProps?: MfTooltipProps
  disabled?: boolean
  unselected?: boolean
  active?: boolean
  size?: 'small' | 'medium' | 'large'
  rounded?: 'smooth' | 'rounded' | 'square'
}

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontXs};
  gap: 4px;
  cursor: pointer;


  &:hover {
    color: ${(props) => props.theme.accentColor};
    background-color: ${(props) => props.theme.hoverColor};
  }

  .btn-icon {
    font-size: 1rem;
  }
`
export const MfIconLabelButton = (props: MfIconLabelButtonProps) => {
  const {
    label,
    onClick,
    tooltipProps,
    iconRef,
    disabled = false,
    icon,
  } = props

  const iconCls = classNames('btn-icon', icon)

  const content = (
    <Wrapper onClick={disabled ? undefined : onClick}>
      <i ref={iconRef} className={iconCls}></i>
      {label && <span className='icon-label'>{label}</span>}
    </Wrapper>
  )

  if (tooltipProps) {
    const { title, ...contentProps } = tooltipProps

    if (!title) return content

    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent {...contentProps}>{title}</TooltipContent>
      </Tooltip>
    )
  }

  return content
}
