import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { preparePdfExportMarkdown } from './pdfExportMarkdown'

const directive = '%%{init:{"theme":"default"}}%%'
const parser = new MarkdownIt({ html: true })
const diagrams = (source: string) => parser.parse(source, {})
  .filter((token) => token.type === 'fence' && token.info.trim() === 'mermaid')
  .map((token) => token.content)

describe('export-only Mermaid Markdown theme', () => {
  it('changes only real Mermaid fence content and leaves the source and other Markdown untouched', () => {
    const source = '# Title\n\n```mermaid\nflowchart LR\nA --> B\n```\n\n```ts\nconst mermaid = 1\n```\n'
    const result = preparePdfExportMarkdown(source)
    expect(result).toBe(source.replace('flowchart LR', `${directive}\nflowchart LR`))
    expect(source).not.toContain(directive)
    expect(preparePdfExportMarkdown(result)).toBe(result)
  })

  it('ignores inline code, indented code and Mermaid-looking fences inside a longer ordinary code fence', () => {
    const source = '`mermaid`\n\n    ```mermaid\n    flowchart LR\n\n````markdown\n```mermaid\nA-->B\n```\n````\n\n> quoted mermaid text\n'
    expect(preparePdfExportMarkdown(source)).toBe(source)
  })

  it.each([
    '> ```mermaid\n> flowchart LR\n> A --> B\n> ```\n',
    '- ```mermaid\n  flowchart LR\n  A --> B\n  ```\n',
    '> 1. ~~~mermaid\n>    flowchart LR\n>    A --> B\n>    ~~~\n',
  ])('retains container syntax and produces one valid diagram in %s', (source) => {
    const result = preparePdfExportMarkdown(source)
    expect(diagrams(result)).toEqual([directive + '\n' + diagrams(source)[0]])
    expect(result.replace(/^.*%%\{init:.*\n/m, '')).toBe(source)
  })

  it('places the local directive after YAML frontmatter and before existing user directives', () => {
    const source = '```mermaid\n---\ntitle: Chinese diagram\nconfig:\n  themeVariables:\n    primaryColor: "#ffeecc"\n---\n%%{init:{"theme":"dark"}}%%\nflowchart LR\nA --> B\n```\n'
    const result = preparePdfExportMarkdown(source)
    expect(result).toBe(source.replace('---\n%%{init:', `---\n${directive}\n%%{init:`))
    expect(diagrams(result)[0]).toContain(`---\n${directive}\n%%{init:{"theme":"dark"}}%%`)
  })

  it.each([
    'config:\n  theme: dark',
    '"config": {"theme": "forest"}',
    'defaults: &config\n  theme: dark\nconfig: *config',
  ])('preserves an explicit YAML theme without overriding it: %s', (yaml) => {
    const source = `\`\`\`mermaid\n---\n${yaml}\n---\nflowchart LR\nA --> B\n\`\`\`\n`
    expect(preparePdfExportMarkdown(source)).toBe(source)
  })

  it('preserves CRLF bytes outside the inserted line and handles several diagrams independently', () => {
    const source = 'Before\r\n\r\n```mermaid\r\nflowchart LR\r\nA --> B\r\n```\r\n\r\n~~~mermaid\r\nsequenceDiagram\r\nA->>B:Hi\r\n~~~\r\nAfter'
    const expected = source.replace('flowchart LR', `${directive}\r\nflowchart LR`)
      .replace('sequenceDiagram', `${directive}\r\nsequenceDiagram`)
    expect(preparePdfExportMarkdown(source)).toBe(expected)
  })

  it('keeps other explicit initialization settings after the default override', () => {
    const source = '```mermaid\n%%{init:{"layout":"elk","theme":"dark"}}%%\nflowchart LR\nA-->B\n```'
    expect(diagrams(preparePdfExportMarkdown(source))[0])
      .toBe(`${directive}\n%%{init:{"layout":"elk","theme":"dark"}}%%\nflowchart LR\nA-->B\n`)
  })
})
