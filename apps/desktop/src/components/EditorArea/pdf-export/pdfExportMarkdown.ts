import MarkdownIt from 'markdown-it'
import { parseDocument } from 'yaml'

const parser = new MarkdownIt({ html: true })
const lightDirective = '%%{init:{"theme":"default"}}%%'

function frontmatter(source: string): { lines: number; explicitTheme: boolean } {
  const match = /^\s*---[ \t]*\n([\s\S]*?)\n[ \t]*---[ \t]*(?:\n|$)/.exec(source)
  if (!match) return { lines: 0, explicitTheme: false }
  const document = parseDocument(match[1])
  if (document.errors.length) throw new Error('Mermaid frontmatter could not be read for PDF export.')
  const data: unknown = document.toJS({ maxAliasCount: 100 })
  const config = data && typeof data === 'object' && 'config' in data ? data.config : undefined
  return {
    lines: match[0].split('\n').length - (match[0].endsWith('\n') ? 1 : 0),
    explicitTheme: Boolean(config && typeof config === 'object' && Object.hasOwn(config, 'theme')),
  }
}

/** Change only export-only Mermaid fences; retain the captured Markdown verbatim elsewhere. */
export function preparePdfExportMarkdown(markdown: string): string {
  const lines: { offset: number; text: string; ending: string }[] = []
  let offset = 0
  for (const line of markdown.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g) ?? []) {
    if (!line) break
    const ending = /(?:\r\n|\r|\n)$/.exec(line)?.[0] ?? ''
    lines.push({ offset, text: line.slice(0, line.length - ending.length), ending })
    offset += line.length
  }
  const insertions: { offset: number; text: string }[] = []
  for (const token of parser.parse(markdown, {})) {
    if (token.type !== 'fence' || token.info.trim() !== 'mermaid' || !token.map || !token.content.trim()) continue
    const metadata = frontmatter(token.content)
    if (metadata.explicitTheme || token.content.includes(lightDirective)) continue
    const opening = lines[token.map[0]]
    const target = lines[token.map[0] + 1 + metadata.lines]
    if (!opening || !target) continue
    const marker = opening.text.indexOf(token.markup)
    if (marker < 0) continue
    // Keep blockquote markers and turn list markers into continuation indent.
    const prefix = opening.text.slice(0, marker).replace(/[^>\t ]/g, ' ')
    insertions.push({ offset: target.offset, text: prefix + lightDirective + (opening.ending || '\n') })
  }
  let result = markdown
  for (const insertion of insertions.reverse())
    result = result.slice(0, insertion.offset) + insertion.text + result.slice(insertion.offset)
  return result
}
