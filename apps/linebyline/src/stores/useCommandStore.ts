import { create } from 'zustand'

const useCommandStore = create<CommandStore>((set, get) => {
  return {
    commands: {},
    addCommand: ({ id, handler }) => {
      set((state) => {
        return {
          ...state,
          commands: {
            ...state.commands,
            [id]: {
              exec: handler,
            },
          },
        }
      })
    },
    execute: (id: string) => {
      const { commands } = get()
      const command = commands[id]
      if (command) {
        command.exec()
      } else {
        console.error(`command ${id} not found`)
      }
    },
  }
})

interface CommandStore {
  commands: Commands
  addCommand: (command: { id: string; handler: () => any }) => void
  execute: (id: string) => void
}

export default useCommandStore

type Commands = Record<string, Command>

interface Command {
  exec: () => void
}
