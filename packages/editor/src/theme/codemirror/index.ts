import { tags as t } from '@lezer/highlight'
import type { CreateThemeOptions } from '@uiw/codemirror-themes'
import { createTheme } from '@uiw/codemirror-themes'

export const defaultSettingsLight: CreateThemeOptions['settings'] = {
  background: '#fdfdfd',
  foreground: '#24292e',
  selection: '#0369a1',
  selectionMatch: '#0369a1',
  gutterBackground: '#fdfdfd',
  gutterForeground: '#fdfdfd',
}

export const LightInit = (options?: Partial<CreateThemeOptions>) => {
  const { theme = 'light', settings = {}, styles = [] } = options || {}
  return createTheme({
    theme: theme,
    settings: {
      ...defaultSettingsLight,
      ...settings,
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
      ...styles,
    ],
  })
}

export const light = LightInit()

export const defaultSettingsDark: CreateThemeOptions['settings'] = {
  background: '#11191f',
  foreground: '#c9d1d9',
  caret: '#c9d1d9',
  selection: '#1c78aa',
  selectionMatch: '#1c78aa',
  lineHighlight: '#36334280',
}

export const darkInit = (options?: Partial<CreateThemeOptions>) => {
  const { theme = 'dark', settings = {}, styles = [] } = options || {}
  return createTheme({
    theme: theme,
    settings: {
      ...defaultSettingsDark,
      ...settings,
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
      ...styles,
    ],
  })
}

export const dark = darkInit()
