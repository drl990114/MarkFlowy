import { defaultFilter } from 'cmdk'

export interface SearchableCommand {
  id: string
  label: string
  categoryLabel: string
  keywords: readonly string[]
}

export function rankPaletteCommands<T extends SearchableCommand>(
  commands: readonly T[],
  query: string,
  recent: readonly string[],
): T[] {
  const search = query.trim()
  if (!search) return [...commands]
  const recency = new Map(recent.map((id, index) => [id, index]))
  return commands
    .map((command, index) => ({
      command,
      index,
      score: Math.max(
        ...[command.label, ...command.keywords, command.categoryLabel, command.id].map((label) =>
          defaultFilter(label, search),
        ),
        defaultFilter(`${command.categoryLabel} ${command.label}`, search, [...command.keywords]) *
          0.95,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (recency.get(a.command.id) ?? Infinity) - (recency.get(b.command.id) ?? Infinity) ||
        a.index - b.index,
    )
    .map(({ command }) => command)
}
