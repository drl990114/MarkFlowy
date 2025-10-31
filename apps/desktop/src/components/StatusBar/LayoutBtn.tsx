import { useCommandStore } from '@/stores'
import useLayoutStore from '@/stores/useLayoutStore'
import { memo, useRef } from 'react'
import styled from 'styled-components'

export const LayoutLeftBtn = memo(() => {
  const ref = useRef<HTMLDivElement>(null)
  const { leftBar } = useLayoutStore()

  return (
    <Container
      ref={ref}
      className='icon-small icon-smooth'
      active={leftBar.visible}
      onClick={() => {
        useCommandStore.getState().execute('app_toggleLeftsidebarVisible')
      }}
    >
      <i className='ri-layout-left-line'></i>
    </Container>
  )
})

export const LayoutRightBtn = () => {
  const ref = useRef<HTMLDivElement>(null)
  const { rightBar } = useLayoutStore()

  return (
    <Container
      ref={ref}
      className='icon-small icon-smooth'
      active={rightBar.visible}
      onClick={() => {
        useCommandStore.getState().execute('app_toggleRightsidebarVisible')
      }}
    >
      <i className='ri-layout-right-line'></i>
    </Container>
  )
}

const Container = styled.div<{ active: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;
  color: ${(props) => props.active ? props.theme.accentColor : 'inherit'};

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
  }
`
