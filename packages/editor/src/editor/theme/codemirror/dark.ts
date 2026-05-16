import { tags as t } from '@lezer/highlight'
import type { CreateThemeOptions} from '@drl990114/codemirror-themes'

export const codemirrorDark: CreateThemeOptions = {
  theme: 'dark',
  settings: {
    background: '#11191f',
    foreground: '#c9d1d9',
    caret: '#c9d1d9',
    selection: '#1c78aa',
    selectionMatch: '#1c78aa',
    lineHighlight: '#36334280',
  },
  styles: [
    { tag: [t.standard(t.tagName), t.tagName], color: '#7ee787' },
    { tag: [t.comment, t.bracket], color: '#8b949e' },
    { tag: [t.className, t.propertyName], color: '#d2a8ff' },
    { tag: [t.variableName, t.attributeName, t.number, t.operator], color: '#D19A66' },
    { tag: [t.keyword, t.typeName, t.typeOperator, t.typeName], color: '#ff7b72' },
    { tag: [t.string, t.meta, t.regexp], color: '#98C379' },
    { tag: [t.name, t.quote], color: '#7ee787' },
    { tag: [t.heading], color: '#E06C75', fontWeight: 'bold' },
    { tag: [t.emphasis], color: '#d2a8ff', fontStyle: 'italic' },
    { tag: [t.deleted], color: '#ffdcd7', backgroundColor: 'ffeef0' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#ffab70' },
    { tag: [t.url, t.escape, t.link], color: '#D19A66' },
    { tag: t.link, textDecoration: 'underline' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.invalid, color: '#f97583' },
    { tag: t.strong, color: '#98C379', fontWeight: 'bold' },
  ],
}
