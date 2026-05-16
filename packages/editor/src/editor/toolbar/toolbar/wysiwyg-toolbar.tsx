import { FC } from 'react'
import styled from 'styled-components'
import { Ariakit } from 'zens'
import { InsertSeparatorButton } from './command-btns/insert-separator-button'
import { RedoButton } from './command-btns/redo-button'
import { ToggleBlockquoteButton } from './command-btns/toggle-blockquote-button'
import { ToggleBoldButton } from './command-btns/toggle-bold-button'
import { ToggleBulletListButton } from './command-btns/toggle-bullet-list-button'
import { ToggleCodeBlockButton } from './command-btns/toggle-code-block-button'
import { ToggleCodeButton } from './command-btns/toggle-code-button'
import { ToggleHeadingButton } from './command-btns/toggle-heading-button'
import { ToggleItalicButton } from './command-btns/toggle-italic-button'
import { ToggleOrderedListButton } from './command-btns/toggle-ordered-list-button'
import { ToggleTaskListButton } from './command-btns/toggle-task-list-button'
import { UndoButton } from './command-btns/undo-button'

export type WysiwygToolbarProps = {
  className?: string
  style?: React.CSSProperties
  prevActions?: React.ReactNode
  nextActions?: React.ReactNode
}

export const WysiwygToolbar: FC<WysiwygToolbarProps> = (props) => {
  const { prevActions = null, nextActions = null } = props

  return (
    <ToolBar className={props.className} style={props.style}>
      {prevActions}
      <UndoButton />
      <RedoButton />
      <ToolbarSeparator render={<div />} />
      <ToggleHeadingButton />
      <ToggleBoldButton />
      <ToggleItalicButton />
      <ToggleBlockquoteButton />
      <ToggleCodeBlockButton />
      <ToggleCodeButton />
      <InsertSeparatorButton />
      <ToolbarSeparator render={<div />} />
      <ToggleBulletListButton />
      <ToggleOrderedListButton />
      <ToggleTaskListButton />
      {nextActions}
    </ToolBar>
  )
}

const ToolBar = styled(Ariakit.Toolbar)`
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
  height: 28px;
  font-size: ${(props) => props.theme.fontSm};
  color: ${(props) => props.theme.primaryFontColor};
  background-color: ${(props) => props.theme.editorToolbarBgColor};
`

const ToolbarSeparator = styled(Ariakit.ToolbarSeparator)`
  height: 0.5em;
  margin: 0 0.25em;
  border-right-width: 1px;
  border-right-style: solid;
  border-color: ${(props) => props.theme.labelFontColor};
`
