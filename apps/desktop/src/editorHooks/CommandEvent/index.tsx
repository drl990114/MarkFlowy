import bus from '@/helper/eventBus'
import { useCommands } from '@linebyline/editor'
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

export const useCommandEvent: FC<EditorStateProps> = ({}: EditorStateProps) => {
  const commands = useCommands()

  useEffect(() => {
    const handler = (payload: CreateTableCommand) => {
      commands.createTable(payload)
    }
    bus.on('editor:create_table', handler)

    return () => {
      bus.detach('editor:create_table', handler)
    }
  }, [commands])

  return null
}

interface EditorStateProps {
  active: boolean
}
