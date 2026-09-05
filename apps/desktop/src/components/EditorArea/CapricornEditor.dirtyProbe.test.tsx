import { readFileSync } from 'node:fs'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { CapricornEditor, type CapricornEditorHandle } from './CapricornEditor'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  type CapricornRuntimeAdapter,
} from './capricornRuntimeAdapter'

afterEach(cleanup)

// These probes use the private runtime, which is optional in public checkouts and CI.
it.skipIf(!isCapricornRuntimeAvailable).each([
  ['empty', ''],
  ['plain', 'Hello\n'],
  ['paragraphs', '# Title\n\nHello **world**.\n\nSecond paragraph.\n'],
  ['code', '```ts\nconst x = 1\n```\n'],
  ['list', '- first\n- second\n\n1. one\n2. two\n'],
  ['table', '| A | B |\n| --- | --- |\n| one | two |\n'],
  ['frontmatter', '---\ntitle: test\n---\n\n## Heading\n\nHello\n'],
  ['readme', readFileSync('../../README.md', 'utf8')],
])('probe open %s', async (_name, markdown) => {
  const onChange = vi.fn()
  const onError = vi.fn()
  const onUnavailable = vi.fn()
  let adapter: CapricornRuntimeAdapter | null = null
  const ref = createRef<CapricornEditorHandle>()
  const { container } = render(
    <div data-editor-id='probe' data-editor-active='true' style={{ height: 900 }}>
      <CapricornEditor
        ref={ref}
        active
        editorId='probe'
        initialMarkdown={markdown}
        onChange={onChange}
        onError={onError}
        onUnavailable={onUnavailable}
        onEditorChange={(value) => { adapter = value }}
        options={{
          virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
          typewriter: { enabled: false },
          readOnly: false,
          spellCheck: true,
          density: 'compact',
          copilot: false,
          style: { fontSize: 16, lineHeight: '1.7' },
        }}
      />
    </div>,
  )
  await waitFor(() => expect(container.querySelector('[data-cap-content]')).not.toBeNull())
  await act(async () => {
    await adapter?.getStatistics?.()
    adapter?.headings.getAll()
    adapter?.headings.getNumbering()
    adapter?.focus()
    await new Promise((resolve) => window.setTimeout(resolve, 60))
  })
  expect(onError).not.toHaveBeenCalled()
  expect(onUnavailable).not.toHaveBeenCalled()
  expect(onChange.mock.calls).toEqual([])
})
