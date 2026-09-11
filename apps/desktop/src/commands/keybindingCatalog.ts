import { z } from 'zod'
import defaults from './keybindingDefaults.json'

const platformSchema = z.enum(['mac', 'windows', 'linux'])
const scopeSchema = z.enum(['always', 'editor_focus'])
const keysSchema = z.array(z.string())
const ruleSchema = z.object({
  id: z.string().min(1),
  command: z.string().min(1),
  keys: keysSchema,
  when: scopeSchema,
  platforms: z.partialRecord(platformSchema, keysSchema).optional(),
})
const commandSchema = z.object({
  id: z.string().min(1),
  configurable: z.boolean(),
  target: z.enum(['app', 'editor', 'native']),
  editor: z.object({ rme: z.string(), capricornRule: z.string().optional() }).optional(),
})
const catalog = z
  .object({
    commands: z.array(commandSchema),
    rules: z.array(ruleSchema),
  })
  .parse(defaults)

export type KeybindingCommand = z.infer<typeof commandSchema>
export type KeybindingRule = z.infer<typeof ruleSchema>
export type KeybindingScope = z.infer<typeof scopeSchema>
export type EditorShortcutMap = Record<string, string | readonly string[]>

export interface KeyboardBinding {
  /** Rule identity, independent of the command and the editor implementation. */
  id: string
  command: string
  keys: string[]
  defaultKeys: string[]
  when: KeybindingScope
  configurable: boolean
  target: KeybindingCommand['target']
}
export interface KeybindingSnapshot {
  revision: number
  rules: KeyboardBinding[]
}

export const keybindingCommands: readonly KeybindingCommand[] = catalog.commands
export const defaultKeybindingRules: readonly KeybindingRule[] = catalog.rules
const commands = new Map(keybindingCommands.map((command) => [command.id, command]))

export function getKeybindingCommand(id: string): KeybindingCommand | undefined {
  return commands.get(id)
}

export function getDefaultKeybindings(platform: z.infer<typeof platformSchema>): KeyboardBinding[] {
  return defaultKeybindingRules.map((rule) => {
    const command = commands.get(rule.command)!
    const keys = [...(rule.platforms?.[platform] ?? rule.keys)]
    return {
      id: rule.id,
      command: rule.command,
      keys,
      defaultKeys: [...keys],
      when: rule.when,
      configurable: command.configurable,
      target: command.target,
    }
  })
}

export function shortcutAlternatives(keys: string | readonly string[]): readonly string[] {
  return typeof keys === 'string' ? (keys ? [keys] : []) : keys.filter(Boolean)
}
