import { EDITOR_CSS_SCOPE_CLASS } from './editorCssScope'
import type { CssSnippet } from './library'

const scope = `.${EDITOR_CSS_SCOPE_CLASS} [data-cap-content]`

export const cssSnippetTemplates = [
  {
    id: 'completed-tasks',
    label: 'cssTemplateCompletedTasks',
    css: `${scope} .capricorn-markdown-list-item:has(> .capricorn-markdown-task-prefix > .capricorn-markdown-task-checkbox:checked) > .capricorn-markdown-list-content {
  text-decoration: line-through;
}`,
  },
  {
    id: 'heading-dividers',
    label: 'cssTemplateHeadingDividers',
    css: `${scope} :is(h1, h2) {
  border-bottom: 1px solid var(--mf-theme-border-default);
  padding-bottom: 0.3em;
}`,
  },
  {
    id: 'compact-tables',
    label: 'cssTemplateCompactTables',
    css: `${scope} :is(.capricorn-markdown-table-cell, .capricorn-markdown-inline-table-cell) {
  padding: 2px 8px;
}`,
  },
  {
    id: 'quote-accent',
    label: 'cssTemplateQuoteAccent',
    css: `${scope} :is(blockquote.capricorn-markdown-blockquote, .capricorn-markdown-quoted-block) {
  background-image: repeating-linear-gradient(to right, var(--mf-theme-accent-background) 0, var(--mf-theme-accent-background) 2px, transparent 2px, transparent 1em);
}`,
  },
] as const

/** Keep the draft in its saved cascade position, including when currently disabled. */
export function snippetPreviewStyles(snippets: readonly CssSnippet[], draft: CssSnippet) {
  const ordered = snippets.some((item) => item.id === draft.id) ? snippets : [...snippets, draft]
  return ordered.flatMap((item) => {
    const preview = item.id === draft.id ? draft : item
    return preview.id === draft.id || preview.enabled ? [{ id: preview.id, css: preview.css }] : []
  })
}
