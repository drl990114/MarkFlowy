import type { CapricornSnippet } from './types'

const definitions = [
  { id: 'math-fraction', kind: 'math', source: String.raw`\frac{a}{b}` },
  {
    id: 'mermaid-flow',
    kind: 'mermaid',
    source: 'flowchart TD\n  A[Start] --> B{Ready?}\n  B -->|Yes| C[Finish]\n  B -->|No| A',
  },
  {
    id: 'code-json',
    kind: 'code',
    language: 'json',
    source: '{\n  "name": "example",\n  "enabled": true\n}',
  },
] as const

export function getBuiltinSnippets(translate: (key: string) => string): CapricornSnippet[] {
  return definitions.map((item) => ({
    ...item,
    id: `builtin:${item.id}`,
    title: translate(`snippets.builtins.${item.id}`),
  }))
}

export function getVisibleSnippets(
  library: { items: readonly CapricornSnippet[]; hiddenBuiltinIds: readonly string[] },
  translate: (key: string) => string,
): CapricornSnippet[] {
  const hidden = new Set(library.hiddenBuiltinIds)
  return [...library.items, ...getBuiltinSnippets(translate).filter((item) => !hidden.has(item.id))]
}
