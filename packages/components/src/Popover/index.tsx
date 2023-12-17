import type { PopoverProps as AkPopoverProps, PopoverProviderProps } from '@ariakit/react'
import { PopoverArrow, PopoverProvider, PopoverDisclosure, PopoverHeading } from '@ariakit/react'
import { PopoverWrapper } from './PopoverWrapper'
import { Box } from '../Box'

type PopoverOptions = Pick<PopoverProviderProps, 'placement' | 'open'> &
  Pick<AkPopoverProps, 'onClose'>

interface PopoverProps extends BaseComponentProps, PopoverOptions {
  arrow?: boolean
  title?: string
  customContent?: React.ReactNode
  placement?: PopoverProviderProps['placement']
  children?: BaseComponentProps['children']
}

const Popover: React.FC<PopoverProps> = (props) => {
  const { arrow = true, title, children, customContent, placement, ...rest } = props

  return (
    <PopoverProvider placement={placement}>
      <PopoverDisclosure render={(p) => <Box style={{ display: 'inline-block' }} {...p}></Box>}>
        {children}
      </PopoverDisclosure>
      <PopoverWrapper render={<Box></Box>} {...rest}>
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
