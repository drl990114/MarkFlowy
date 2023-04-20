import {
  BasicFormattingButtonGroup,
  DataTransferButtonGroup,
  HeadingLevelButtonGroup,
  HistoryButtonGroup,
  Remirror,
  ThemeProvider,
  ToggleCodeBlockButton,
  ToggleStrikeButton,
  Toolbar,
  VerticalDivider,
} from '@remirror/react'
import { AllStyledComponent } from '@remirror/styles/emotion'
import { useGlobalRemirror } from '@hooks'
import Bridge from './bridge'
function EditorToolbar() {
  return (
    <Toolbar>
      <HistoryButtonGroup />
      <VerticalDivider />
      <DataTransferButtonGroup />
      <VerticalDivider />
      <HeadingLevelButtonGroup />
      <VerticalDivider />
      <BasicFormattingButtonGroup />
      <VerticalDivider />
      <ToggleStrikeButton />
      <VerticalDivider />
      <ToggleCodeBlockButton />
    </Toolbar>
  )
}

export default function Editor() {
  const { remirror } = useGlobalRemirror()
  const { manager, state, onChange } = remirror

  return (
    <AllStyledComponent>
      <ThemeProvider>
        <Remirror manager={manager} onChange={onChange} initialContent={state} autoFocus autoRender="end">
          <EditorToolbar />
          <Bridge />
        </Remirror>
      </ThemeProvider>
    </AllStyledComponent>
  )
}
