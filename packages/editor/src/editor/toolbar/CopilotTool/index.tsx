import { isTextSelection } from '@rme-sdk/core'
import { useExtension, useRemirrorContext } from '@rme-sdk/react-core'
import { useMemo, useState } from 'react'
import { usePopper } from 'react-popper'
import styled from 'styled-components'
import { CopilotExtension, type CopilotState } from '../../extensions/Copilot/copilot-extension'
import { editorZIndex } from '../../theme/z-index'

export const CopilotTool = () => {
  const { view: editorView, getState } = useRemirrorContext({ autoUpdate: true })
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
  const editorState = editorView ? getState() : null
  const copilotExtension = useExtension(CopilotExtension)
  const pluginState = copilotExtension.getPluginState() as CopilotState | undefined

  const virtualReference = useMemo(() => {
    if (!editorView || !editorState) return
    const domNode = editorView.domAtPos(editorState.selection.to)?.node
    const cursorPosition = editorView.state.selection.to
    const cursorLeft = editorView.coordsAtPos(cursorPosition).left

    if (!(domNode instanceof HTMLElement)) return

    const { top, height } = domNode.getBoundingClientRect()

    return {
      getBoundingClientRect() {
        return {
          top: top + height,
          right: cursorLeft,
          bottom: top + height,
          left: cursorLeft,
          width: 0,
          height: height,
          x: cursorLeft,
          y: top + height,
          toJSON: () =>
            JSON.stringify({
              top: top + height,
              right: cursorLeft,
              bottom: top + height,
              left: cursorLeft,
              width: 0,
              height: height,
              x: cursorLeft,
              y: top + height,
            }),
        }
      },
    }
  }, [editorView, editorState])

  const { styles, attributes } = usePopper(virtualReference, popperElement, {
    placement: 'bottom-start',
    modifiers: [
      { name: 'flip', enabled: true },
      {
        name: 'preventOverflow',
      },
    ],
  })

  const shouldShow =
    Boolean(editorView) &&
    Boolean(editorState) &&
    Boolean(pluginState) &&
    pluginState?.status !== 'idle' &&
    pluginState?.pos !== null &&
    isTextSelection(editorState!.selection) &&
    editorState!.selection.empty &&
    editorState!.selection.from === pluginState!.pos

  const content = shouldShow
    ? pluginState!.status === 'loading'
      ? 'Copilot ...'
      : pluginState!.suggestion
    : ''

  if (!shouldShow || (pluginState?.status === 'ready' && !content.trim())) {
    return null
  }

  return (
    <Container
      ref={setPopperElement}
      style={{
        ...styles.popper,
      }}
      {...attributes.popper}
    >
      {content}
    </Container>
  )
}

const Container = styled.div`
  min-width: 180px;
  max-width: 360px;
  padding: ${(props) => props.theme.spaceSm};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  border: 1px solid ${(props) => props.theme.slashMenuBorderColor};
  background-color: ${(props) => props.theme.contextMenuBgColor};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontSm};
  box-shadow:
    0 1px 4px -2px ${(props) => props.theme.boxShadowColor},
    0 2px 8px 0 ${(props) => props.theme.boxShadowColor},
    0 8px 16px 4px ${(props) => props.theme.boxShadowColor};
  z-index: ${editorZIndex.floatingMenu};
  pointer-events: none;
  white-space: pre-wrap;
`
