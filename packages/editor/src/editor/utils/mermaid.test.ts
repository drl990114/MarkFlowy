import { beforeEach, describe, expect, test, vi } from 'vitest'

const mermaidHarness = vi.hoisted(() => ({
  initialize: vi.fn(),
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: mermaidHarness.initialize,
  },
}))

import { loadMermaid } from './mermaid'

describe('loadMermaid', () => {
  beforeEach(() => {
    mermaidHarness.initialize.mockClear()
  })

  test('locks resource-sensitive settings against diagram directives', async () => {
    await loadMermaid()

    expect(mermaidHarness.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        flowchart: { htmlLabels: false },
        htmlLabels: false,
        securityLevel: 'strict',
        startOnLoad: false,
        secure: expect.arrayContaining([
          'htmlLabels',
          'flowchart',
          'themeCSS',
          'fontFamily',
          'altFontFamily',
        ]),
      }),
    )
  })
})
