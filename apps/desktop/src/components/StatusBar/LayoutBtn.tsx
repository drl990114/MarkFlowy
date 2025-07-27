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
      active={leftBar.visible}
      onClick={() => {
        useCommandStore.getState().execute('app:toggle_leftsidebar_visible')
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
      active={rightBar.visible}
      onClick={() => {
        useCommandStore.getState().execute('app:toggle_rightsidebar_visible')
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
  width: 32px;
  height: 100%;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;
  color: ${(props) => props.active ? props.theme.accentColor : 'inherit'};

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
  }
`
