import styled, { css } from 'styled-components'
import { memo, useRef } from 'react'
import { useCommandStore } from '@/stores'
import { Popover, Tooltip } from 'zens'
import useLayoutStore from '@/stores/useLayoutStore'

const LayoutPanelContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-row-gap: ${(props) => props.theme.spaceSm};
  grid-column-gap: ${(props) => props.theme.spaceSm};
`

const LayoutPanelItemContainer = styled.div<{ active: boolean }>`
  display: flex;
  padding: ${(props) => props.theme.spaceSm};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  background-color: ${(props) => props.theme.borderColor};
  font-size: ${(props) => props.theme.fontH6};

  &:hover {
    background-color: ${(props) => props.theme.accentColor};
  }

  ${(props) =>
    props.active &&
    css`
      background-color: ${(props) => props.theme.accentColor};
    `}
`

interface LayoutPanelItemProps {
  active: boolean
  icon: string
  onClick: () => void
}

const LayoutPanelItem = (props: LayoutPanelItemProps) => {
  return (
    <LayoutPanelItemContainer active={props.active} onClick={props.onClick}>
      <Tooltip title='Grid Layout'>
        <i className={props.icon}></i>
      </Tooltip>
    </LayoutPanelItemContainer>
  )
}

export const LayoutBtn = memo(() => {
  const ref = useRef<HTMLDivElement>(null)
  const { leftBar, rightBar } = useLayoutStore()

  return (
    <Popover
      placement='top-end'
      arrow
      customContent={
        <LayoutPanelContainer>
          <LayoutPanelItem
            icon='ri-layout-left-line'
            active={leftBar.visible}
            onClick={() => {
              useCommandStore.getState().execute('app:toggle_leftsidebar_visible')
            }}
          />
          <LayoutPanelItem
            icon='ri-layout-right-line'
            active={rightBar.visible}
            onClick={() => {
              useCommandStore.getState().execute('app:toggle_rightsidebar_visible')
            }}
          />
        </LayoutPanelContainer>
      }
    >
      <Container ref={ref}>
        <i className='ri-layout-masonry-line'></i>
      </Container>
    </Popover>
  )
})

const Container = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 100%;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
  }
`
