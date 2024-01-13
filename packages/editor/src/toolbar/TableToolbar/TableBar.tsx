import { OffsetContext } from '../../components/WysiwygEditor'
import type { UseMultiPositionerReturn } from '@remirror/react'
import { useCommands } from '@remirror/react'
import { useContext } from 'react'
import styled from 'styled-components'

const Container = styled.div`
  position: absolute;
  color: ${(props) => props.theme.dangerColor};
`

function TableBar(props: TableBarProps) {
  const { positioner } = props
  const commands = useCommands()
  const offset = useContext(OffsetContext)
  const { ref, key, x, y } = positioner

  return (
    <Container
      key={key}
      ref={ref}
      style={{
        left: x + offset.left,
        top: y + offset.top - 26,
        width: 20,
        height: 20,
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        commands.deleteTable()
      }}
    >
      <i className="ri-delete-bin-line" />
    </Container>
  )
}

interface TableBarProps {
  positioner: UseMultiPositionerReturn
}

export default TableBar
