import { useCommands } from '@linebyline/editor'
import { listen } from '@tauri-apps/api/event'
import { useEffect, type FC } from 'react'

type CreateTableCommand =  {
  /**
   * Defines the number of rows to create with.
   *
   * @defaultValue 3
   */
  rowsCount?: number;
  /**
   * Defines the number of columns to create with.
   *
   * @defaultValue 3
   */
  columnsCount?: number;
}

export const useCommandEvent: FC<EditorStateProps> = ({}: EditorStateProps) => {
  const commands = useCommands()

  useEffect(() => {
    const unListen = listen<CreateTableCommand>('editor:create_table', ({ payload }) => {
      commands.createTable(payload)
    })

    return () => {
      unListen.then((fn) => fn())
    }
  }, [commands])

  return null
}

interface EditorStateProps {
  active: boolean
}
