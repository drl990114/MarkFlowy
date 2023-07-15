import { useCommands } from '@remirror/react'
import type { CreateTableCommand } from '@remirror/extension-tables'
import { listen } from '@tauri-apps/api/event'
import { useEffect, type FC } from 'react'

export const useCommandEvent: FC<EditorStateProps> = ({}: EditorStateProps) => {
  const commands = useCommands()

  useEffect(() => {
    const unListen = listen<CreateTableCommand>('editor:create_table', ({ payload }) => {
      console.log('create_table', payload)
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
