import type { UseMultiPositionerReturn } from '@rme-sdk/react'
import { useCommands } from '@rme-sdk/react'
import styled from 'styled-components'
import { Tooltip } from 'zens'

const Container = styled.div`
  position: absolute;
  color: ${(props) => props.theme.dangerColor};
`

function TableBar(props: TableBarProps) {
  const { positioner } = props
  const commands = useCommands()
  const { ref, key, x, y } = positioner

  return (
    <Container
      key={key}
      ref={ref}
      style={{
        left: x - 15 + positioner.width / 2, // selector left: -15px
        top: y + positioner.height,
        width: 20,
        height: 20,
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        commands.deleteTable?.()
      }}
    >
      <Tooltip title="delete">
        <i className="ri-delete-bin-line" />
      </Tooltip>
    </Container>
  )
}

interface TableBarProps {
  positioner: UseMultiPositionerReturn
}

export default TableBar
