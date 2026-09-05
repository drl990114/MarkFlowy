/** Pure deterministic fixtures; never imported by the application entrypoint. */
export const EDITOR_OPENING_FIXTURE_BYTES = 2 * 1024 * 1024

const denseMixed =
  '# Heading\n\nParagraph with **strong** and [link](https://example.invalid).\n\n- item one\n- item two\n\n```js\nconst a = 1;\n```\n\n'
const ordinaryMixed =
  '# Heading\n\n' +
  'Paragraph with **strong** and [link](https://example.invalid). '.repeat(10) +
  '\n\n- item one\n- item two\n\n```js\nconst a = 1;\n```\n\n'
const secondaryMixed =
  '## Heading\n\n' +
  'Ordinary Markdown prose with **bold** emphasis and a [link](https://example.test) in context. '.repeat(
    12,
  ) +
  '\n\n- First list item\n- Second item\n\n```ts\nconst answer = 42;\n```\n\n'
const tableRows =
  '| Name | Value | Notes |\n| --- | ---: | --- |\n' +
  '| Item | 42 | Paragraph with **strong** text |\n'.repeat(8)
const ordinaryTables =
  '# Data section\n\n' +
  'Ordinary prose surrounding a small Markdown table. '.repeat(80) +
  `\n\n${tableRows}\n` +
  'More prose after the table keeps this a normal mixed document. '.repeat(80) +
  '\n\n'
const denseTables = `# Table\n\n${tableRows}\n`

export const EDITOR_OPENING_FIXTURES = {
  paragraph: { stress: false, unit: 'A plain paragraph with words. '.repeat(12) + '\n\n' },
  'mixed-ordinary': { stress: false, unit: ordinaryMixed },
  // Distinct from the original reviewed corpus; used by the source A/B harness.
  'mixed-secondary': { stress: false, unit: secondaryMixed },
  'mixed-dense': { stress: true, unit: denseMixed },
  cjk: {
    stress: false,
    unit: '# 中文标题\n\n' + '中文正文、English、😀 与 **强调**。'.repeat(20) + '\n\n',
  },
  tables: { stress: false, unit: ordinaryTables },
  resources: {
    stress: false,
    unit:
      '# Resources\n\n![Local image](./editor-opening-fixture.svg)\n\n' +
      'A resource must not block ordinary text. '.repeat(16) +
      '\n\n$$\nx^2 + y^2 = z^2\n$$\n\n```mermaid\ngraph LR\nA-->B\n```\n\n',
  },
  'short-blocks': { stress: true, unit: 'a\n\n' },
  'dense-tables': { stress: true, unit: denseTables },
  'long-paragraph': { stress: true, unit: 'a' },
  'large-table': { stress: true, unit: '| one | two |\n' },
  'wide-table': { stress: true, unit: '| column ' },
  'long-code': { stress: true, unit: 'x' },
} as const

export type EditorOpeningFixtureName = keyof typeof EDITOR_OPENING_FIXTURES

export function createEditorOpeningFixture(
  name: EditorOpeningFixtureName,
  byteLength = EDITOR_OPENING_FIXTURE_BYTES,
): string {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0)
    throw new RangeError('Expected a non-negative byte count')
  if (name === 'wide-table') {
    const columns = Math.floor(Math.max(0, byteLength - 6) / 17)
    const table =
      '| H '.repeat(columns) +
      '|\n' +
      '| --- '.repeat(columns) +
      '|\n' +
      '| text '.repeat(columns) +
      '|\n'
    return table.slice(0, byteLength) + 'x'.repeat(Math.max(0, byteLength - table.length))
  }
  if (name === 'long-code') {
    const prefix = '```text\n'
    const suffix = '\n```\n'
    if (byteLength < prefix.length + suffix.length) return 'x'.repeat(byteLength)
    return prefix + 'x'.repeat(byteLength - prefix.length - suffix.length) + suffix
  }
  const { unit } = EDITOR_OPENING_FIXTURES[name]
  const encoder = new TextEncoder()
  const prefix = name === 'large-table' ? '| A | B |\n| --- | --- |\n' : ''
  const available = byteLength - encoder.encode(prefix).byteLength
  if (available < 0) return 'x'.repeat(byteLength)
  const unitBytes = encoder.encode(unit).byteLength
  const repeats = Math.floor(available / unitBytes)
  let remainder = available - repeats * unitBytes
  // Keep the secondary source benchmark byte-identical, including its x tail.
  if (name === 'mixed-secondary') return unit.repeat(repeats) + 'x'.repeat(remainder)
  let tail = ''
  for (const character of unit) {
    const size = encoder.encode(character).byteLength
    if (size > remainder) break
    tail += character
    remainder -= size
    if (remainder === 0) break
  }
  return prefix + unit.repeat(repeats) + tail + 'x'.repeat(remainder)
}

export function summarizeOpeningDurations(values: readonly number[]) {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Expected at least one finite non-negative duration')
  }
  const sorted = [...values].sort((a, b) => a - b)
  const percentile = (fraction: number) => sorted[Math.ceil(sorted.length * fraction) - 1]
  return {
    samples: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: sorted[sorted.length - 1],
  }
}
