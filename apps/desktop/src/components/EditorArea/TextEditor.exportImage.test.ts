import { runInNewContext } from 'node:vm'
import { isCapricornView } from '@/constants/editorViewType'
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
let automationRenderer: ts.Expression | undefined
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'exportImageHandler')
    handler = node.initializer
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'renderElementToImageDataUrl')
    renderer = node
  if (
    ts.isBinaryExpression(node) &&
    node.left.getText(source) === 'automationHandleRef.current' &&
    ts.isObjectLiteralExpression(node.right)
  ) {
    const render = node.right.properties.find(
      (property) => ts.isPropertyAssignment(property) && property.name.getText(source) === 'render',
    )
    if (render && ts.isPropertyAssignment(render)) automationRenderer = render.initializer
  }
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

if (!automationRenderer) throw new Error('Automation renderer was not found')
const compiledAutomationRenderer = ts.transpileModule(`(${automationRenderer.getText(source)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

describe('TextEditor image export ownership', () => {
  it.each(['cancel', 'failure'])(
    'releases image ownership when the save dialog ends with %s',
    async (outcome) => {
      const releaseImages = vi.fn()
      const exportImage = runInNewContext(compiled, {
        active: true,
        id: 'file',
        currentViewType: 'preview',
        isCapricornView,
        getFileObject: () => ({ name: 'note.md' }),
        remoteImages: { retain: () => releaseImages },
        useEditorStore: { getState: () => ({ getEditorContent: () => 'snapshot' }) },
        capricornEditorRef: { current: null },
        save: async () => {
          if (outcome === 'failure') throw new Error('Dialog failed')
          return null
        },
        t: (key: string) => key,
        toast: { error: vi.fn() },
      }) as () => Promise<void>
      await exportImage()
      expect(releaseImages).toHaveBeenCalledOnce()
    },
  )

  it('normalizes cloned colors and preserves the live DOM', async () => {
    const element = document.createElement('div')
    element.innerHTML = '<input type="checkbox" disabled><svg></svg>'
    const clone = element.cloneNode(true) as HTMLElement
    const normalizeClonedExportColors = vi.fn()
    const canvas = { toDataURL: vi.fn(() => 'data:image/jpeg;base64,exported') }
    const html2canvas = vi.fn(async (_root, options) => {
      await options.onclone?.(document, clone)
      expect(options.ignoreElements(clone.querySelector('svg'))).toBe(false)
      return canvas
    })
    const renderImage = runInNewContext(compiledRenderer, {
      loadHtml2Canvas: async () => html2canvas,
      EXPORT_RESOURCE_TIMEOUT_MS: 15_000,
      normalizeClonedExportColors,
      canvasToExportDataUrl: (value: typeof canvas) => value.toDataURL(),
    }) as (root: HTMLElement) => Promise<string>
    await expect(renderImage(element)).resolves.toBe('data:image/jpeg;base64,exported')
    expect(normalizeClonedExportColors).toHaveBeenCalledExactlyOnceWith(document, clone)
    expect(element.querySelector('input')!.disabled).toBe(true)
  })

  it('rejects a tainted canvas instead of returning a media-free or text-only JPG', async () => {
    const error = new Error('SecurityError')
    const html2canvas = vi.fn(async () => {
      throw error
    })
    const renderImage = runInNewContext(compiledRenderer, {
      loadHtml2Canvas: async () => html2canvas,
      EXPORT_RESOURCE_TIMEOUT_MS: 15_000,
      normalizeClonedExportColors: vi.fn(),
    }) as (root: HTMLElement) => Promise<string>
    await expect(renderImage(document.createElement('div'))).rejects.toBe(error)
    expect(html2canvas).toHaveBeenCalledOnce()
  })

  it.each(
    ['wysiwyg', 'preview', 'sourceCode'].flatMap((mode) =>
      ['success', 'surface', 'resources', 'render', 'write'].map((outcome) => ({ mode, outcome })),
    ),
  )(
    'exports the full $mode snapshot and disposes the surface after $outcome',
    async ({ mode, outcome }) => {
      const dispose = vi.fn()
      const restore = vi.fn()
      const element = document.createElement('div')
      const createMarkdownImageSurface = vi.fn(async () => {
        if (outcome === 'surface') throw new Error('Preview rendering failed')
        return { element, dispose }
      })
      let markdown = 'Snapshot before dialog'
      const toast = { loading: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn() }
      const releaseImages = vi.fn()
      const remoteImages = { retain: vi.fn(() => releaseImages) }
      const renderImage = vi.fn(async (target) => {
        expect(target).toBe(element)
        if (outcome === 'render') throw new Error('Render failed')
        return 'image'
      })
      const writeImage = vi.fn(async () => ({
        code: outcome === 'write' ? 1 : 0,
        content: 'Write failed',
      }))
      const exportImage = runInNewContext(compiled, {
        active: true,
        remoteImages,
        id: 'file',
        EditorViewType: { WYSIWYG: 'wysiwyg' },
        currentViewType: mode,
        isCapricornView,
        getFileObject: () => ({ name: 'note.md', path: '/notes/note.md' }),
        useEditorStore: { getState: () => ({ getEditorContent: () => markdown }) },
        fileTypeConfig: { type: 'markdown' },
        createMarkdownImageSurface,
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
        invoke: writeImage,
        FileResultCode: { Success: 0 },
      }) as () => Promise<void>
      await exportImage()
      expect(createMarkdownImageSurface).toHaveBeenCalledExactlyOnceWith('Snapshot before dialog')
      expect(dispose).toHaveBeenCalledTimes(outcome === 'surface' ? 0 : 1)
      expect(restore).toHaveBeenCalledTimes(['surface', 'resources'].includes(outcome) ? 0 : 1)
      expect(writeImage).toHaveBeenCalledTimes(['success', 'write'].includes(outcome) ? 1 : 0)
      expect(toast.success).toHaveBeenCalledTimes(outcome === 'success' ? 1 : 0)
      expect(toast.error).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1)
      expect(toast.dismiss).toHaveBeenCalledOnce()
      expect(remoteImages.retain).toHaveBeenCalledOnce()
      expect(releaseImages).toHaveBeenCalledOnce()
    },
  )

  it.each(['wysiwyg', 'preview', 'sourceCode'])(
    'CLI JPG waits for the same static snapshot in %s mode',
    async (mode) => {
      const element = document.createElement('div')
      const dispose = vi.fn()
      const restore = vi.fn()
      const releaseImages = vi.fn()
      let resolveSurface!: (value: { element: HTMLElement; dispose: () => void }) => void
      const createMarkdownImageSurface = vi.fn(
        () =>
          new Promise<{ element: HTMLElement; dispose: () => void }>((resolve) => {
            resolveSurface = resolve
          }),
      )
      const renderImage = vi.fn(async () => 'data:image/jpeg;base64,exported')
      const render = runInNewContext(compiledAutomationRenderer, {
        id: 'file',
        automationHandleRef: { current: { readContent: () => 'CLI snapshot' } },
        currentViewType: mode,
        isCapricornView,
        capricornEditorRef: { current: null },
        fileTypeConfig: { type: 'markdown' },
        remoteImages: { retain: () => releaseImages },
        createMarkdownImageSurface,
        prepareResourcesForExport: async () => restore,
        getFolderPathFromPath: () => '/notes',
        getFileObject: () => ({ path: '/notes/note.md' }),
        renderElementToImageDataUrl: renderImage,
        canvasDataToBinary: () => [1, 2, 3],
        Uint8Array,
      }) as (format: string) => Promise<Uint8Array>
      const result = render('jpg')
      expect(createMarkdownImageSurface).toHaveBeenCalledExactlyOnceWith('CLI snapshot')
      expect(renderImage).not.toHaveBeenCalled()
      resolveSurface({ element, dispose })
      await expect(result).resolves.toEqual(new Uint8Array([1, 2, 3]))
      expect(renderImage).toHaveBeenCalledExactlyOnceWith(element)
      expect(restore).toHaveBeenCalledOnce()
      expect(dispose).toHaveBeenCalledOnce()
      expect(releaseImages).toHaveBeenCalledOnce()
    },
  )
})
