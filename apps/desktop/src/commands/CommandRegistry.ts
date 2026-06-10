import { logger } from '@/helper/logger'

export interface Command {
  id: string
  label?: string
  category?: string
  handler: (...args: any[]) => unknown | Promise<unknown>
  icon?: string
  when?: string
}

export interface Disposable {
  dispose: () => void
}

type CommandListener = (command: Command) => void
type CommandListListener = (commands: Command[]) => void

class CommandRegistryImpl {
  private commands = new Map<string, Command>()
  private listeners = new Set<CommandListener>()
  private listListeners = new Set<CommandListListener>()

  private emitCommandListChange(): void {
    const commands = this.getAllCommands()
    this.listListeners.forEach((fn) => fn(commands))
  }

  registerCommand(command: Command): Disposable {
    this.commands.set(command.id, command)
    this.listeners.forEach((fn) => fn(command))
    this.emitCommandListChange()
    return { dispose: () => this.unregisterCommand(command.id) }
  }

  unregisterCommand(id: string): void {
    this.commands.delete(id)
    this.emitCommandListChange()
  }

  async execute(id: string, ...args: any[]): Promise<unknown> {
    const command = this.commands.get(id)
    if (command) {
      return command.handler(...args)
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

  onDidChangeCommands(listener: CommandListListener): Disposable {
    this.listListeners.add(listener)
    listener(this.getAllCommands())
    return { dispose: () => this.listListeners.delete(listener) }
  }
}

export const commandRegistry = new CommandRegistryImpl()
