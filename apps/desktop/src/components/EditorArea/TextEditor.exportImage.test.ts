import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import textEditorSource from './TextEditor.tsx?raw'

const source = ts.createSourceFile(
  'TextEditor.tsx',
  textEditorSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
let handler: ts.Expression | undefined
let renderer: ts.FunctionDeclaration | undefined
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'exportImageHandler')
    handler = node.initializer
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'renderElementToImageDataUrl')
    renderer = node
  ts.forEachChild(node, visit)
}
visit(source)
if (!handler) throw new Error('Export image handler was not found')
const compiled = ts.transpileModule(`(${handler.getText(source)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

if (!renderer) throw new Error('Image renderer was not found')
const compiledRenderer = ts.transpileModule(`(${renderer.getText(source)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

describe('TextEditor image export ownership', () => {
  it.each([false, true])(
    'normalizes clone colors on the main render and security retry (retry=%s)',
    async (retry) => {
      const element = document.createElement('div')
      element.innerHTML = '<input type="checkbox" disabled>'
      const clone = element.cloneNode(true)
      const normalizeClonedExportColors = vi.fn()
      const sanitizeClonedExportDocument = vi.fn()
      const canvas = { toDataURL: vi.fn(() => 'data:image/jpeg;base64,exported') }
      let attempts = 0
      const html2canvas = vi.fn(async (_root, options) => {
        await options.onclone?.(document, clone)
        attempts += 1
        if (retry && attempts === 1) throw new Error('SecurityError')
        return canvas
      })
      const renderImage = runInNewContext(compiledRenderer, {
        loadHtml2Canvas: async () => html2canvas,
        EXPORT_RESOURCE_TIMEOUT_MS: 15_000,
        normalizeClonedExportColors,
        sanitizeClonedExportDocument,
        ignoreRiskyExportElement: vi.fn(),
        isSecurityError: (error: unknown) => String(error).includes('SecurityError'),
        canvasToExportDataUrl: (value: typeof canvas) => value.toDataURL(),
        logger: { warn: vi.fn() },
      }) as (root: HTMLElement) => Promise<string>
      await expect(renderImage(element)).resolves.toBe('data:image/jpeg;base64,exported')
      expect(normalizeClonedExportColors).toHaveBeenCalledTimes(retry ? 2 : 1)
      expect(normalizeClonedExportColors).toHaveBeenLastCalledWith(document, clone)
      expect(sanitizeClonedExportDocument).toHaveBeenCalledTimes(retry ? 1 : 0)
      expect(element.querySelector('input')!.disabled).toBe(true)
    },
  )
  it.each(['success', 'resources', 'render', 'write'])(
    'uses the read snapshot and disposes the complete surface after %s',
    async (outcome) => {
      const dispose = vi.fn()
      const restore = vi.fn()
      const element = document.createElement('div')
      const createExportSurface = vi.fn(async () => ({ element, dispose }))
      let markdown = 'Snapshot before dialog'
      const toast = { loading: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() }
      const renderImage = vi.fn(async (target) => {
        expect(target).toBe(element)
        if (outcome === 'render') throw new Error('Render failed')
        return 'image'
      })
      const exportImage = runInNewContext(compiled, {
        active: true,
        id: 'file',
        EditorViewType: { WYSIWYG: 'wysiwyg' },
        currentViewType: 'wysiwyg',
        getFileObject: () => ({ name: 'note.md', path: '/notes/note.md' }),
        useEditorStore: { getState: () => ({ getEditorContent: () => markdown }) },
        capricornEditorRef: { current: { createExportSurface } },
        save: async () => {
          markdown = 'Edits while dialog is open'
          return '/export.jpg'
        },
        t: (key: string) => key,
        toast,
        logger: { error: vi.fn() },
        getFolderPathFromPath: () => '/notes',
        prepareResourcesForExport: async () => {
          if (outcome === 'resources') throw new Error('Resources failed')
          return restore
        },
        renderElementToImageDataUrl: renderImage,
        canvasDataToBinary: () => [],
        invoke: async () => ({ code: outcome === 'write' ? 1 : 0, content: 'Write failed' }),
        FileResultCode: { Success: 0 },
      }) as () => Promise<void>
      await exportImage()
      expect(createExportSurface).toHaveBeenCalledExactlyOnceWith('Snapshot before dialog')
      expect(dispose).toHaveBeenCalledOnce()
      expect(restore).toHaveBeenCalledTimes(outcome === 'resources' ? 0 : 1)
      expect(toast.error).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1)
      expect(toast.dismiss).toHaveBeenCalledOnce()
    },
  )
})
