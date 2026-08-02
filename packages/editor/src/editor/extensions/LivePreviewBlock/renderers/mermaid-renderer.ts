import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import { eventBus } from '../../../utils/eventbus'
import { loadMermaid, prepareMermaidSource } from '../../../utils/mermaid'
import { minimalSetup } from '../../CodeMirror/setup'
import type { LivePreviewNodeViewApi, LivePreviewRenderer } from '../live-preview-types'

const renderCount = { count: 0 }
let renderQueue: Promise<void> = Promise.resolve()
const unsafeMermaidResourcePattern = /(?:<\s*img\b|\burl\s*\()/i

function runInRenderQueue<T>(render: () => Promise<T>): Promise<T> {
  const result = renderQueue.then(render)
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

function assertSafeMermaidSource(source: string): void {
  if (unsafeMermaidResourcePattern.test(source)) {
    throw new Error('Unsafe resource syntax is not allowed in Mermaid previews.')
  }
}

function assertSafeMermaidDiagram(diagram: unknown): void {
  const db = (diagram as { db?: { getVertices?: () => unknown } })?.db
  if (!db?.getVertices) {
    return
  }

  const vertices = db.getVertices()
  const values =
    vertices instanceof Map
      ? Array.from(vertices.values())
      : vertices && typeof vertices === 'object'
        ? Object.values(vertices)
        : []
  const hasImageShape = values.some(
    (vertex) =>
      vertex !== null && typeof vertex === 'object' && Boolean((vertex as { img?: unknown }).img),
  )
  if (hasImageShape) {
    throw new Error('Mermaid image shapes are not allowed in previews.')
  }
}

export function createMermaidRenderer(options: {
  codemirrorExtensions?: CodeMirrorExtension[]
}): LivePreviewRenderer {
  return {
    languageName: 'mermaid',
    displayName: 'Mermaid',
    className: 'mf-live-preview-mermaid',
    getCodeMirrorExtensions: () => options.codemirrorExtensions ?? [minimalSetup],
    render: async (content, container) => {
      const source = content.trim()
      container.replaceChildren()

      if (!source) {
        return
      }
      assertSafeMermaidSource(source)

      renderCount.count++
      const id = `mermaid-${renderCount.count}`
      try {
        const svg = await runInRenderQueue(async () => {
          const { externalLayout, renderSource } = prepareMermaidSource(source)
          const mermaid = await loadMermaid({ externalLayout })
          const diagram = await mermaid.mermaidAPI.getDiagramFromText(renderSource)
          assertSafeMermaidDiagram(diagram)
          return (await mermaid.render(id, renderSource)).svg
        })
        const template = document.createElement('template')
        template.innerHTML = svg
        template.content.querySelectorAll('image').forEach((image) => image.remove())
        template.content
          .querySelectorAll('a')
          .forEach((anchor) => anchor.replaceWith(...anchor.childNodes))
        container.replaceChildren(template.content)
      } catch (err) {
        document.getElementById('d' + id)?.remove()
        throw err
      }
    },
    onMount: (view: LivePreviewNodeViewApi) => {
      eventBus.on('change-theme', view.render)
    },
    onDestroy: (view: LivePreviewNodeViewApi) => {
      eventBus.detach('change-theme', view.render)
    },
  }
}
