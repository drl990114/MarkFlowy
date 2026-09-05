import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  createEditorOpeningFixture,
  EDITOR_OPENING_FIXTURES,
  EDITOR_OPENING_FIXTURE_BYTES,
} from '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts'

export function selectEditorOpeningFixtures(selected = 'ordinary') {
  if (selected === 'all') return Object.keys(EDITOR_OPENING_FIXTURES)
  if (selected === 'ordinary')
    return Object.keys(EDITOR_OPENING_FIXTURES).filter(
      (name) => !EDITOR_OPENING_FIXTURES[name].stress,
    )
  if (!Object.hasOwn(EDITOR_OPENING_FIXTURES, selected))
    throw new Error(`Unknown fixture: ${selected}`)
  return [selected]
}

export async function exportEditorOpeningFixtures({
  outputDir,
  selected = 'ordinary',
  force = false,
}) {
  if (typeof outputDir !== 'string' || !outputDir.trim())
    throw new TypeError('Expected an explicit output directory')
  const absoluteOutputDir = resolve(outputDir)
  await mkdir(absoluteOutputDir, { recursive: true })
  const results = []
  for (const name of selectEditorOpeningFixtures(selected)) {
    const markdown = createEditorOpeningFixture(name)
    const content = Buffer.from(markdown, 'utf8')
    if (content.byteLength !== EDITOR_OPENING_FIXTURE_BYTES)
      throw new Error(`${name} is not exactly 2 MiB`)
    const path = resolve(absoluteOutputDir, `${name}.md`)
    await writeFile(path, content, { flag: force ? 'w' : 'wx' })
    results.push({
      fixture: name,
      stress: EDITOR_OPENING_FIXTURES[name].stress,
      path,
      bytes: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
    })
  }
  return results
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      'output-dir': { type: 'string' },
      fixture: { type: 'string', default: 'ordinary' },
      force: { type: 'boolean', default: false },
    },
  })
  const results = await exportEditorOpeningFixtures({
    outputDir: values['output-dir'],
    selected: values.fixture,
    force: values.force,
  })
  for (const result of results) console.log(JSON.stringify(result))
}
