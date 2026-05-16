import { useExtension, useRemirrorContext } from '@rme-sdk/react-core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePopper } from 'react-popper'
import styled from 'styled-components'
import { SlashMenuExtension } from '../../extensions/SlashMenu'
import type { SlashMenuState } from '../../extensions/SlashMenu/type'
import { SlashMetaTypes } from '../../extensions/SlashMenu/type'
import { dispatchWithMeta } from '../../extensions/SlashMenu/utils'
import { isBrowser } from '../../utils/common'
import { SlashMenuRoot } from './SlashMenuRoot'

export enum Placement {
  auto = 'auto',
  autoStart = 'auto-start',
  autoEnd = 'auto-end',
  top = 'top',
  topStart = 'top-start',
  topEnd = 'top-end',
  bottom = 'bottom',
  bottomStart = 'bottom-start',
  bottomEnd = 'bottom-end',
  right = 'right',
  rightStart = 'right-start',
  rightEnd = 'right-end',
  left = 'left',
  leftStart = 'left-start',
  leftEnd = 'left-end',
}

export const SlashMenu = () => {
  const { view: editorView, getState, commands } = useRemirrorContext({ autoUpdate: true })
  if (!editorView) {
    return
  }

  const editorState = getState()

  const slashMenuExtension = useExtension(SlashMenuExtension)
  const menuState: SlashMenuState = slashMenuExtension.getPluginState()

  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rootRef) return

    const outsideClickHandler = (event: MouseEvent) => {
      if (
        rootRef.current &&
        (!event.target ||
          !(event.target instanceof Node) ||
          !rootRef.current.contains(event?.target))
      ) {
        dispatchWithMeta(editorView, slashMenuExtension.pluginKey, {
          type: SlashMetaTypes.close,
        })
      }
    }

    if (isBrowser()) {
      document.addEventListener('mousedown', outsideClickHandler)
    }

    return () => {
      if (isBrowser()) {
        document.removeEventListener('mousedown', outsideClickHandler)
      }
    }
  }, [editorView, rootRef, slashMenuExtension.pluginKey])

  const [popperElement, setPopperElement] = useState(null)

  const virtualReference = useMemo(() => {
    const domNode = editorView.domAtPos(editorState.selection.to)?.node
    const cursorPosition = editorView.state.selection.to
    const cursorLeft = editorView.coordsAtPos(cursorPosition).left

    if (!(domNode instanceof HTMLElement)) return

    const { top, height } = domNode.getBoundingClientRect()

    return {
      getBoundingClientRect() {
        return {
          top: top,
          right: cursorLeft,
          bottom: top,
          left: cursorLeft,
          width: 0,
          height: height,
          x: cursorLeft,
          y: top,
          toJSON: () =>
            JSON.stringify({
              top: top,
              right: cursorLeft,
              bottom: top,
              left: cursorLeft,
              width: 0,
              height: height,
              x: cursorLeft,
              y: top,
            }),
        }
      },
    }
  }, [editorView, editorState])

  const { styles, attributes } = usePopper(virtualReference, popperElement, {
    placement: Placement.bottomStart,
    modifiers: [
      { name: 'flip', enabled: true },
      {
        name: 'preventOverflow',
      },
    ],
  })

  const closeMenu = useCallback((config: {
    insertSlash?: boolean
  }) => {
    if (menuState.open) {
      dispatchWithMeta(editorView, slashMenuExtension.pluginKey, {
        type: SlashMetaTypes.close,
      })


      if (config?.insertSlash) {
        editorView.dispatch(
          editorView.state.tr.insertText('/').setMeta(slashMenuExtension.pluginKey, {
            type: SlashMetaTypes.close,
          }),
        )
      }
      editorView.focus()
    }
  }, [editorView, menuState.open, slashMenuExtension.pluginKey])

  return (
    <>
      {menuState.open ? (
        <Container
          // @ts-ignore
          ref={setPopperElement}
          style={{
            ...styles.popper,
          }}
          {...attributes.popper}
        >
          <SlashMenuRoot rootRef={rootRef} commands={commands} closeMenu={closeMenu} />
        </Container>
      ) : null}
    </>
  )
}

const Container = styled.div`
  border-radius: 4px;
  border: 1px solid ${(props) => props.theme.slashMenuBorderColor};
  z-index: 1000;
`
