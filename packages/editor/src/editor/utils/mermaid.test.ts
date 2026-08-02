import { beforeEach, describe, expect, test, vi } from 'vitest'

const mermaidHarness = vi.hoisted(() => ({
  initialize: vi.fn(),
  registerIconPacks: vi.fn(),
  registerLayoutLoaders: vi.fn(),
}))

const elkLayouts = vi.hoisted(() => [{ name: 'elk' }])
const tidyTreeLayouts = vi.hoisted(() => [{ name: 'tidy-tree' }])
const lucideIcons = vi.hoisted(() => ({ icons: {}, prefix: 'lucide' }))
const logosIcons = vi.hoisted(() => ({ icons: {}, prefix: 'logos' }))

vi.mock('mermaid', () => ({
  default: {
    initialize: mermaidHarness.initialize,
    registerIconPacks: mermaidHarness.registerIconPacks,
    registerLayoutLoaders: mermaidHarness.registerLayoutLoaders,
  },
}))

vi.mock('@mermaid-js/layout-elk', () => ({
  default: elkLayouts,
}))

vi.mock('@mermaid-js/layout-tidy-tree', () => ({
  default: tidyTreeLayouts,
}))

vi.mock('@iconify-json/lucide', () => ({
  icons: lucideIcons,
}))

vi.mock('@iconify-json/logos', () => ({
  icons: logosIcons,
}))

import { loadMermaid, prepareMermaidSource } from './mermaid'

describe('loadMermaid', () => {
  beforeEach(() => {
    mermaidHarness.initialize.mockClear()
    mermaidHarness.registerIconPacks.mockClear()
    mermaidHarness.registerLayoutLoaders.mockClear()
  })

  test('locks resource-sensitive settings without loading ELK for ordinary diagrams', async () => {
    await loadMermaid()

    expect(mermaidHarness.registerLayoutLoaders).not.toHaveBeenCalled()
    expect(mermaidHarness.registerIconPacks).toHaveBeenCalledTimes(1)
    const iconPacks = mermaidHarness.registerIconPacks.mock.calls[0][0]
    expect(iconPacks.map((pack: { name: string }) => pack.name)).toEqual(['lucide', 'logos'])
    await expect(iconPacks[0].loader()).resolves.toBe(lucideIcons)
    await expect(iconPacks[1].loader()).resolves.toBe(logosIcons)
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

  test('registers the official ELK layouts on demand', async () => {
    await loadMermaid({ externalLayout: 'elk' })

    expect(mermaidHarness.registerLayoutLoaders).toHaveBeenCalledWith(elkLayouts)
  })

  test('registers the official tidy-tree layouts on demand', async () => {
    await loadMermaid({ externalLayout: 'tidy-tree' })

    expect(mermaidHarness.registerLayoutLoaders).toHaveBeenCalledWith(tidyTreeLayouts)
  })
})

describe('prepareMermaidSource', () => {
  test('uses ELK for flowcharts with directional subgraphs', () => {
    const source = `flowchart LR
      subgraph left["Left"]
        direction TB
        A --> B
      end
      B --> C`

    expect(prepareMermaidSource(source)).toEqual({
      externalLayout: 'elk',
      renderSource: `%%{init: {"layout": "elk"}}%%\n${source}`,
    })
  })

  test('keeps ordinary flowcharts on the default layout', () => {
    const source = 'flowchart LR\nA --> B'

    expect(prepareMermaidSource(source)).toEqual({ renderSource: source })
  })

  test('respects an explicitly selected layout', () => {
    const source = `---
config:
  layout: dagre
---
flowchart LR
  subgraph left
    direction TB
    A --> B
  end`

    expect(prepareMermaidSource(source)).toEqual({ renderSource: source })
  })

  test('loads tidy-tree when explicitly selected', () => {
    const source = `---
config:
  layout: tidy-tree
---
mindmap
  root((Markdown))
    Edit
    Preview`

    expect(prepareMermaidSource(source)).toEqual({
      externalLayout: 'tidy-tree',
      renderSource: source,
    })
  })
})
