import type { PopoverProps as AkPopoverProps, PopoverProviderProps } from '@ariakit/react'
import { PopoverArrow, PopoverProvider, PopoverDisclosure, PopoverHeading } from '@ariakit/react'
import { PopoverWrapper } from './PopoverWrapper'

interface PopoverProps extends BaseComponentProps, AkPopoverProps {
  arrow?: boolean
  title?: string
  customContent?: React.ReactNode
  placement?: PopoverProviderProps['placement']
  children?: React.ReactElement
}

const Popover: React.FC<PopoverProps> = (props) => {
  const { arrow = true, title, children, customContent, placement, ...rest } = props

  return (
    <PopoverProvider placement={placement}>
      <PopoverDisclosure>{children}</PopoverDisclosure>
      <PopoverWrapper {...rest}>
        {arrow ? (
          <PopoverArrow style={{ width: '18px', height: '18px' }} className='arrow' />
        ) : null}
        {title ? <PopoverHeading className='heading'>{title}</PopoverHeading> : null}
        {customContent}
      </PopoverWrapper>
    </PopoverProvider>
  )
}

export default Popover
