import { Button, Flex } from 'antd'
import type { FC } from 'react'

export const FindController: FC<{
  findPrev: () => void
  findNext: () => void
  stopFind: () => void
  caseSensitive: boolean
  toggleCaseSensitive: () => void
  onDismiss?: () => void
}> = ({ findPrev, findNext, stopFind, caseSensitive, toggleCaseSensitive, onDismiss }) => (
  <Flex gap={8}>
    <Button
      shape='circle'
      size='small'
      icon={<i className='ri-arrow-left-s-fill' />}
      onClick={findPrev}
    />
    <Button
      shape='circle'
      size='small'
      icon={<i className='ri-arrow-right-s-fill' />}
      onClick={findNext}
    />
    <Button
      type={caseSensitive ? 'primary' : 'default'}
      shape='circle'
      size='small'
      icon={<i className='ri-font-size' />}
      onClick={toggleCaseSensitive}
    />
    <Button
      onClick={() => {
        stopFind()
        onDismiss?.()
      }}
      shape='circle'
      size='small'
      icon={<i className='ri-close-line' />}
    />
  </Flex>
)
