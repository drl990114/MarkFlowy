import {
  BasicFormattingButtonGroup,
  DataTransferButtonGroup,
  HeadingLevelButtonGroup,
  HistoryButtonGroup,
  Remirror,
  ToggleCodeBlockButton,
  ToggleStrikeButton,
  Toolbar,
  VerticalDivider,
} from '@remirror/react'
import { useGlobalRemirror } from '@hooks'
import Wrapper from './Wrapper'
import Text from './Text'

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
    <Wrapper >
      <Remirror manager={manager} onChange={onChange} initialContent={state} >
        <Text className="h-full w-full overflow-scroll scrollbar-hide"/>
      </Remirror>
    </Wrapper>
  )
}
