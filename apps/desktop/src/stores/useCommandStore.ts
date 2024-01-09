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

    execute: (id: string, ...args) => {
      const { commands } = get()
      const command = commands[id]
      if (command) {
        command.exec(...args)
      } else {
        console.warn(`command ${id} not found`)
      }
    },
  }
})

interface CommandStore {
  commands: Commands
  addCommand: (command: { id: string; handler: (args?: any) => void }) => void
  execute: (id: string, ...args: any) => void
}

export default useCommandStore

type Commands = Record<string, Command>

interface Command {
  exec: (args?: any) => void 
}
