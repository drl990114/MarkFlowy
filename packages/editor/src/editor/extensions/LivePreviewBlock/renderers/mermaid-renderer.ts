import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import mermaid from 'mermaid'
import { eventBus } from '../../../utils/eventbus'
import { minimalSetup } from '../../CodeMirror/setup'
import type { LivePreviewNodeViewApi, LivePreviewRenderer } from '../live-preview-types'

const renderCount = { count: 0 }

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

      renderCount.count++
      const id = `mermaid-${renderCount.count}`
      try {
        const { svg, bindFunctions } = await mermaid.render(id, source)
        container.innerHTML = svg
        bindFunctions?.(container)
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
