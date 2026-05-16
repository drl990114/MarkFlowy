import { tags as t } from '@lezer/highlight'
import type { CreateThemeOptions} from '@drl990114/codemirror-themes'

export const codemirrorLight: CreateThemeOptions= {
  theme: 'light',
  settings: {
    background: '#fdfdfd',
    foreground: '#24292e',
    selection: '#0369a1',
    selectionMatch: '#0369a1',
    gutterBackground: '#fdfdfd',
    gutterForeground: '#fdfdfd',
  },
  styles: [
    { tag: [t.standard(t.tagName), t.tagName], color: '#116329' },
    { tag: [t.comment, t.bracket], color: '#6a737d' },
    { tag: [t.className, t.propertyName], color: '#6f42c1' },
    { tag: [t.variableName, t.attributeName, t.number, t.operator], color: '#0000CC' },
    { tag: [t.keyword, t.typeName, t.typeOperator], color: '#d73a49' },
    { tag: [t.string, t.meta, t.regexp], color: '#0055AA' },
    { tag: [t.name, t.quote], color: '#22863a' },
    { tag: [t.heading], color: '#0000FF', fontWeight: 'bold' },
    { tag: [t.emphasis], color: '#24292e', fontStyle: 'italic' },
    { tag: [t.deleted], color: '#b31d28', backgroundColor: 'ffeef0' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#e36209' },
    { tag: [t.url, t.escape, t.link], color: '#E06C75' },
    { tag: t.link, textDecoration: 'underline' },
    { tag: t.strikethrough, textDecoration: 'line-through', color: 'red' },
    { tag: t.invalid, color: '#cb2431' },
    { tag: t.strong, color: '#0055AA', fontWeight: 'bold' },
  ],
}
