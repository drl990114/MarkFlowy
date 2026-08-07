import { describe, expect, it } from 'vitest'
import { NodeExtension, RemirrorManager, type NodeExtensionSpec } from '@rme-sdk/sdk/core'
import { corePreset } from '@rme-sdk/sdk/presets/core'

import { MarkdownParser } from '../../transform/parser'
import { ParserRuleType } from '../../transform/parser-type'
import { initDocMarks } from './inline-mark-helpers'
import { markExtensions } from './inline-mark-extensions'

class DiagnosticHtmlInlineNodeExtension extends NodeExtension {
  static disableExtraAttributes = true

  get name() {
    return 'html_inline_node' as const
  }

  createNodeSpec(): NodeExtensionSpec {
    return {
      inline: true,
      atom: true,
      marks: '',
      attrs: { htmlText: { default: '' } },
      toDOM: () => ['span'],
    }
  }
}

function createStringToDoc() {
  const htmlInline = new DiagnosticHtmlInlineNodeExtension({})
  const manager = RemirrorManager.create([
    ...corePreset(),
    ...markExtensions(),
    htmlInline,
  ])
  const parser = new MarkdownParser(manager.schema, [
    { type: ParserRuleType.block, token: 'paragraph', node: 'paragraph', hasOpenClose: true },
    { type: ParserRuleType.text, token: 'text', getText: (token) => token.content },
    { type: ParserRuleType.text, token: 'inline', getText: (token) => token.content },
    { type: ParserRuleType.text, token: 'softbreak', getText: () => '\n' },
    { type: ParserRuleType.inline, token: 'html_inline_node', node: 'html_inline_node' },
  ])
  return {
    parse: (content: string) => parser.parse(content),
    stringToDoc: (content: string) => initDocMarks(parser.parse(content)),
  }
}

const marks = [
  '*mark*',
  '**mark**',
  '~~mark~~',
  '`mark`',
  '[mark](https://example.com)',
  '[mark][ref]',
]

const excluded = [
  '<span>',
  '</span>',
  '<span>html</span>',
  '<kbd>Ctrl</kbd>',
  '<br>',
  '<img src="x">',
  '![alt](x.png)',
  '$x$',
]

const separators = ['', ' ', '+']

describe('BatchSetMarkStep diagnostic repro scan', () => {
  it('prints markdown inputs that produce unsorted chunks', () => {
    const candidates = new Set<string>([
      '*mark*<span>`qwe`',
      '*mark*<span></span>`qwe`',
      '[foo<span>bar</span>](https://example.com)',
      '[foo<br>bar](https://example.com)',
      '<kbd>Ctrl</kbd> + <kbd>S</kbd>',
    ])

    for (const left of marks) {
      for (const middle of excluded) {
        for (const right of marks) {
          for (const separator of separators) {
            candidates.add(`${left}${separator}${middle}${separator}${right}`)
            candidates.add(`${middle}${separator}${left}${separator}${right}`)
          }
        }
      }
    }

    const { parse, stringToDoc } = createStringToDoc()
    console.log(JSON.stringify(parse('*mark*<span>`qwe`').toJSON(), null, 2))
    const failures: Array<{ markdown: string; message: string }> = []
    for (const markdown of candidates) {
      try {
        stringToDoc(markdown)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('BatchSetMarkStep')) failures.push({ markdown, message })
      }
    }

    console.log(JSON.stringify(failures.slice(0, 100), null, 2))
    expect(failures.length).toBeGreaterThan(0)
  })
})
