export type CapricornSnippetKind = 'math' | 'mermaid' | 'code'

export type CapricornSnippet = {
  id: string
  title: string
  source: string
} & ({ kind: 'math' | 'mermaid' } | { kind: 'code'; language?: string })

export interface CapricornSnippetsOptions {
  items: readonly CapricornSnippet[]
  onManage?: (kind: CapricornSnippetKind) => void
}

export interface SnippetLibrary {
  version: 1
  revision: number
  items: CapricornSnippet[]
  hiddenBuiltinIds: string[]
}

export type SnippetMutation =
  | { type: 'upsert'; item: CapricornSnippet }
  | { type: 'delete'; id: string }
  | { type: 'builtinVisibility'; id: string; hidden: boolean }

export function validSnippet(item: CapricornSnippet): boolean {
  return Boolean(
    item.title.trim() &&
      item.source.trim() &&
      (item.kind !== 'code' || !/[\r\n`]/.test(item.language ?? '')),
  )
}
