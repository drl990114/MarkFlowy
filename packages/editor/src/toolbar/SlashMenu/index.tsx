import { useExtension, useRemirrorContext } from '@remirror/react-core'
import { SlashMenuExtension } from '@/extensions/SlashMenu'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePopper } from 'react-popper'
import { dispatchWithMeta } from '@/extensions/SlashMenu/utils'
import type { SlashMenuState} from '@/extensions/SlashMenu/type'
import { SlashMetaTypes } from '@/extensions/SlashMenu/type'
import { SlashMenuRoot } from './styles'

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

    document.addEventListener('mousedown', outsideClickHandler)

    return () => {
      document.removeEventListener('mousedown', outsideClickHandler)
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

  const closeMenu = useCallback(() => {
    if (menuState.open) {
      dispatchWithMeta(editorView, slashMenuExtension.pluginKey, {
        type: SlashMetaTypes.close,
      })
    }
  }, [editorView, menuState.open, slashMenuExtension.pluginKey])

  // These two useEffects prevent a bug where the user navigates with clicks, which then blurs the editor and key presses stop working
  useEffect(() => {
    editorView.focus()
  }, [menuState?.open])

  return (
    <>
      {menuState.open ? (
        <div
          // @ts-ignore
          ref={setPopperElement}
          style={{
            ...styles.popper,
            backgroundColor: '#1e1e1e',
            zIndex: 1000,
          }}
          {...attributes.popper}
        >
          <SlashMenuRoot rootRef={rootRef} commands={commands} closeMenu={closeMenu} />
        </div>
      ) : null}
    </>
  )
}
