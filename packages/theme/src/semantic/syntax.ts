import { tags } from '@lezer/highlight'
import type { ResolvedTokens } from './registry'
export function codeMirrorSyntaxStyles(tokens: ResolvedTokens) {
  return [
    { tag: tags.comment, color: tokens['syntax.comment'] },
    { tag: [tags.keyword, tags.modifier, tags.typeName], color: tokens['syntax.keyword'] },
    { tag: [tags.string, tags.regexp, tags.escape], color: tokens['syntax.string'] },
    { tag: [tags.number, tags.bool, tags.null], color: tokens['syntax.number'] },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
      color: tokens['syntax.function'],
    },
    { tag: tags.variableName, color: tokens['syntax.variable'] },
    {
      tag: [tags.attributeName, tags.propertyName, tags.className, tags.namespace],
      color: tokens['syntax.attribute'],
    },
    { tag: [tags.tagName, tags.angleBracket], color: tokens['syntax.tag'] },
    { tag: [tags.operator, tags.punctuation, tags.bracket], color: tokens['syntax.punctuation'] },
    { tag: [tags.meta, tags.annotation], color: tokens['syntax.meta'] },
    { tag: tags.inserted, color: tokens['status.success.foreground'] },
    { tag: [tags.deleted, tags.invalid], color: tokens['status.danger.foreground'] },
    // The same theme also renders full Markdown source documents in RME.
    { tag: [tags.heading, tags.strong], color: tokens['editor.foreground'], fontWeight: 'bold' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: [tags.link, tags.url], color: tokens['editor.link'], textDecoration: 'underline' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
  ]
}
