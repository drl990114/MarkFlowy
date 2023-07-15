import { PositionerPortal, useCommands, useMultiPositioner } from '@remirror/react'
import { useEffect } from 'react'
import ActiveCellMenu from './ActiveCellMenu'
import TitleBar from './TableBar'
import type { PositionerIllustrationProps} from './positioner'
import { activeCellColumnAndRowPositioner } from './positioner'

const MultiPositionerIllustration = ({ positioner }: PositionerIllustrationProps) => {
  const positioners = useMultiPositioner(positioner, [])
  const { forceUpdatePositioners } = useCommands()

  useEffect(() => {
    forceUpdatePositioners()
  }, [forceUpdatePositioners])

  if (positioners.length === 0) return null

  const positionersRender = [TitleBar, ActiveCellMenu]

  return (
    <>
      {positioners.map((pos, i) => {
        const Component = positionersRender[i]
        return <Component key={pos.key} positioner={pos} />
      })}
    </>
  )
}

const TableToolbar = () => {
  return (
    <>
      <PositionerPortal>
        <MultiPositionerIllustration positioner={activeCellColumnAndRowPositioner} />
      </PositionerPortal>
    </>
  )
}

export default TableToolbar
