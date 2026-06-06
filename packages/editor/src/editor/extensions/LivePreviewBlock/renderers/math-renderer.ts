import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import { latex } from 'codemirror-lang-latex'
import { tex2svgDisplay } from '../../Math/mathjax'
import type { LivePreviewRenderer } from '../live-preview-types'

export function createMathRenderer(options: {
  codemirrorExtensions?: CodeMirrorExtension[]
}): LivePreviewRenderer {
  return {
    languageName: 'LaTeX',
    displayName: 'LaTeX',
    className: 'mf-live-preview-math',
    getCodeMirrorExtensions: () => [latex(), ...(options.codemirrorExtensions ?? [])],
    render: (content, container) => {
      const source = content.trim()
      container.replaceChildren()

      if (!source) {
        return
      }

      const rendered = document.createElement('div')
      rendered.setAttribute('data-type', 'math-block')
      rendered.innerHTML = tex2svgDisplay(source)
      if (rendered.childElementCount === 1 && rendered.firstElementChild) {
        container.appendChild(rendered.firstElementChild)
      } else {
        container.appendChild(rendered)
      }
    },
  }
}
