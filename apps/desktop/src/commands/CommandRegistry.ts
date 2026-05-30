import { logger } from '@/helper/logger'

export interface Command {
  id: string
  label?: string
  category?: string
  handler: (args?: any) => void
  icon?: string
  when?: string
}

export interface Disposable {
  dispose: () => void
}

type CommandListener = (command: Command) => void

class CommandRegistryImpl {
  private commands = new Map<string, Command>()
  private listeners = new Set<CommandListener>()

  registerCommand(command: Command): Disposable {
    this.commands.set(command.id, command)
    this.listeners.forEach((fn) => fn(command))
    return { dispose: () => this.unregisterCommand(command.id) }
  }

  unregisterCommand(id: string): void {
    this.commands.delete(id)
  }

  execute(id: string, ...args: any[]): void {
    const command = this.commands.get(id)
    if (command) {
      command.handler(...args)
    } else {
      logger.warn(`command ${id} not found`)
    }
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id)
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  hasCommand(id: string): boolean {
    return this.commands.has(id)
  }

  onDidRegisterCommand(listener: CommandListener): Disposable {
    this.listeners.add(listener)
    return { dispose: () => this.listeners.delete(listener) }
  }
}

export const commandRegistry = new CommandRegistryImpl()
