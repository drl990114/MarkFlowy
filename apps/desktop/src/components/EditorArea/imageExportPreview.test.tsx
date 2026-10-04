// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { desktopLightTheme } from '@markflowy/theme'
import * as rmeRuntime from 'rme'
import { createImageExportSurface, type ImageExportSurface } from './imageExportSurface'
import { i18nInit } from '@markflowy/i18n'
import { Preview, ThemeProvider, type PreviewImageHydration } from 'rme'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mermaid = vi.hoisted(() => ({
  render: vi.fn(),
}))

// Happy DOM has no SVG layout engine. Keep the workspace RME Markdown parser,
// static preview renderer and MathJax real; control only Mermaid's SVG output.
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    registerIconPacks: vi.fn(),
    mermaidAPI: { getDiagramFromText: vi.fn(async () => ({ db: {} })) },
    render: mermaid.render,
  },
}))

vi.mock('@/stores/useThemeStore', () => ({
  FALLBACK_LIGHT_THEME: 'MarkFlowy Light',
  FALLBACK_DARK_THEME: 'MarkFlowy Dark',
}))

beforeAll(async () => {
  await i18nInit({ lng: 'en' })
})

beforeEach(() => {
  mermaid.render.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('workspace RME static preview for JPG export', () => {
  it('settles only after rendered math, Mermaid and the complete document are committed', async () => {
    let finishMermaid!: (value: { svg: string }) => void
    mermaid.render.mockReturnValue(
      new Promise<{ svg: string }>((resolve) => {
        finishMermaid = resolve
      }),
    )
    const markdown = [
      '# Export document',
      'Inline formula $x^2+y^2$ ends here.',
      '$$\n\\frac{a}{b}\n$$',
      '```math\nc^2 = a^2 + b^2\n```',
      '```mermaid\nflowchart LR\n  A[Start] --> B[End]\n```',
      ...Array.from({ length: 260 }, (_, index) => `Complete paragraph ${index}.`),
      '```javascript\nconst ordinaryCode = "kept"\n```',
      'Final paragraph after all blocks.',
    ].join('\n\n')
    let hydration: PreviewImageHydration | null = null
    let settled = false
    const onError = vi.fn()
    const { container } = render(
      <ThemeProvider>
        <Preview
          doc={markdown}
          onError={onError}
          onImageHydrationChange={(current) => {
            hydration = current
            settled = false
            void current?.settled.then(() => {
              if (hydration === current) settled = true
            })
          }}
        />
      </ThemeProvider>,
    )

    await waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce())
    expect(hydration).not.toBeNull()
    expect(settled).toBe(false)
    expect(container.querySelector('.mf-preview-loading')).not.toBeNull()
    expect(container.querySelector('.mf-preview-content')).toBeNull()
    expect(mermaid.render.mock.calls[0]?.[1]).toContain('flowchart LR')

    await act(async () => {
      finishMermaid({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0L20 20"/></svg>',
      })
    })
    await waitFor(() => expect(settled).toBe(true))
    await hydration!.settled

    expect(onError).not.toHaveBeenCalled()
    expect(container.querySelectorAll('.mf-preview-math-inline svg')).toHaveLength(1)
    expect(container.querySelectorAll('.mf-preview-math svg')).toHaveLength(2)
    expect(container.querySelectorAll('.mf-preview-mermaid svg')).toHaveLength(1)
    expect(container.querySelector('.mf-preview-content')?.textContent).toContain(
      'Complete paragraph 259.',
    )
    expect(container.querySelector('.mf-preview-content')?.textContent).toContain(
      'Final paragraph after all blocks.',
    )
    expect(container.querySelector('pre[data-type="code-block"] code')?.textContent).toBe(
      'const ordinaryCode = "kept"',
    )
    expect(container.querySelector('.mf-preview-content')?.textContent).not.toContain(
      'flowchart LR',
    )
    expect(container.querySelector('.mf-preview-content')?.textContent).not.toContain(
      '\\frac{a}{b}',
    )
    expect(container.querySelector('.mf-preview-content')?.textContent).not.toContain('x^2+y^2')
    expect(
      container.querySelector(
        '.mf-preview-loading, .mf-preview-block-error, .mf-preview-error, .mf-math-error, .cm-editor, [contenteditable="true"]',
      ),
    ).toBeNull()
  })

  it('exposes a failed rich block after settling so the export readiness gate can reject it', async () => {
    mermaid.render.mockRejectedValue(new Error('Mermaid rendering failed'))
    let settled = false
    let currentHydration: PreviewImageHydration | null = null
    const onError = vi.fn()
    const { container } = render(
      <ThemeProvider>
        <Preview
          doc={'```mermaid\nflowchart LR\n  A --> B\n```'}
          onError={onError}
          onImageHydrationChange={(hydration) => {
            currentHydration = hydration
            settled = false
            void hydration?.settled.then(() => {
              if (currentHydration === hydration) settled = true
            })
          }}
        />
      </ThemeProvider>,
    )

    await waitFor(() => expect(settled).toBe(true))
    expect(container.querySelector('.mf-preview-block-error .mf-preview-error')?.textContent).toBe(
      'Mermaid rendering failed',
    )
    expect(container.querySelector('.mf-preview-content')?.textContent).not.toContain(
      'flowchart LR',
    )
    // RME intentionally embeds per-block errors in its static HTML; they do not
    // reach Preview's fatal onError callback, so exports also inspect the DOM.
    expect(onError).not.toHaveBeenCalled()
  })

  it('returns a ready static export surface using the workspace renderer', async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0L20 20"/></svg>',
    })
    const source = document.createElement('div')
    document.body.append(source)
    let surface: ImageExportSurface | undefined
    try {
      let result!: Promise<ImageExportSurface>
      await act(async () => {
        result = createImageExportSurface({
          source,
          markdown:
            'Inline $x^2$\n\n$$\n\\frac{a}{b}\n$$\n\n```mermaid\nflowchart LR\n A-->B\n```\n\nFinal paragraph',
          delegateOptions: {},
          styleToken: { rootFontSize: '16px', rootLineHeight: '1.7' },
          theme: desktopLightTheme,
          loadRuntime: async () => rmeRuntime,
        })
      })
      const settled = result.then((value) => {
        surface = value
      })
      await waitFor(() => expect(surface).toBeDefined())
      await settled
      expect(surface).toBeDefined()
      expect(surface!.element.querySelectorAll('svg')).toHaveLength(3)
      expect(surface!.element.textContent).toContain('Final paragraph')
      expect(surface!.element.textContent).not.toContain('flowchart LR')
      expect(surface!.element.textContent).not.toContain('x^2')
      expect(surface!.element.querySelector('.mf-preview-loading')).toBeNull()
    } finally {
      await act(async () => surface?.dispose())
      expect(document.querySelector('[data-mf-image-export]')).toBeNull()
      source.remove()
    }
  })
})
