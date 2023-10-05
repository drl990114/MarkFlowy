import bus from '@/helper/eventBus'
import { useCommands } from '@markflowy/editor'
import { useEffect, type FC } from 'react'

type CreateTableCommand = {
  /**
   * Defines the number of rows to create with.
   *
   * @defaultValue 3
   */
  rowsCount?: number
  /**
   * Defines the number of columns to create with.
   *
   * @defaultValue 3
   */
  columnsCount?: number
}

export const useCommandEvent: FC<EditorStateProps> = ({ active }: EditorStateProps) => {
  const commands = useCommands()

  useEffect(() => {
    const handler = (payload: CreateTableCommand) => {
      if (active) {
        commands.createTable(payload)
      }
    }
    bus.on('editor:create_table', handler)

    return () => {
      bus.detach('editor:create_table', handler)
    }
  }, [commands, active])

  return null
}

interface EditorStateProps {
  active: boolean
}
