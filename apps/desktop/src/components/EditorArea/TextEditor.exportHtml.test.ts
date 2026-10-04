import { runInNewContext } from 'node:vm'
import { isCapricornView } from '@/constants/editorViewType'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'
import textEditorSource from './TextEditor.tsx?raw'

const source = ts.createSourceFile(
  'TextEditor.tsx',
  textEditorSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
let handler: ts.Expression | undefined
let automationRenderer: ts.Expression | undefined
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'exportHtmlHandler')
    handler = node.initializer
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
if (!handler || !automationRenderer) throw new Error('HTML export entry points were not found')
const compile = (node: ts.Expression) =>
  ts.transpileModule(`(${node.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
const compiledUi = compile(handler)
const compiledCli = compile(automationRenderer)

it.each(['wysiwyg', 'preview', 'sourceCode'])(
  'UI and CLI export the complete unsaved snapshot in %s mode',
  async (mode) => {
    const element = document.createElement('div')
    element.innerHTML = '<h1>Rendered snapshot</h1>'
    const dispose = vi.fn()
    const release = vi.fn()
    const createMarkdownImageSurface = vi.fn(async () => ({ element, dispose }))
    let markdown = 'stale store content'
    const flushForRead = vi.fn(() => {
      markdown = 'Current unsaved snapshot'
    })
    const serialize = vi.fn(async () => {
      expect(dispose).not.toHaveBeenCalled()
      expect(release).not.toHaveBeenCalled()
      return '<html>portable</html>'
    })
    const invoke = vi.fn()
    const bindings = {
      active: true,
      id: 'file',
      currentViewType: mode,
      isCapricornView,
      getFileObject: () => ({ name: 'note.md', path: '/notes/note.md' }),
      curFile: { name: 'note.md', path: '/notes/note.md' },
      remoteImages: { retain: () => release },
      editorWrapperRef: { current: null },
      capricornEditorRef: { current: null },
      editorSnapshotRegistry: { flushForRead },
      useEditorStore: { getState: () => ({ getEditorContent: () => markdown }) },
      fileTypeConfig: { type: 'markdown' },
      createMarkdownImageSurface,
      save: async () => {
        expect(flushForRead).toHaveBeenCalledOnce()
        markdown = 'Edited during dialog'
        return '/export.html'
      },
      t: (key: string) => key,
      toast: {
        loading: vi.fn(() => 'loading'),
        dismiss: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
      },
      getFolderPathFromPath: () => '/notes',
      exportHtmlDocument: serialize,
      invoke,
      TextEncoder,
      automationHandleRef: { current: { readContent: () => 'CLI unsaved snapshot' } },
    }
    await (runInNewContext(compiledUi, bindings) as () => Promise<void>)()
    expect(createMarkdownImageSurface).toHaveBeenCalledExactlyOnceWith('Current unsaved snapshot')
    expect(serialize).toHaveBeenCalledExactlyOnceWith(
      element.innerHTML,
      element,
      'note.md',
      '/notes',
    )
    expect(invoke).toHaveBeenCalledExactlyOnceWith('export_html_to_path', {
      str: '<html>portable</html>',
      path: '/export.html',
    })
    expect(dispose).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
    expect(bindings.toast.error).not.toHaveBeenCalled()
    vi.clearAllMocks()
    const cli = runInNewContext(compiledCli, bindings) as (format: string) => Promise<Uint8Array>
    expect(new TextDecoder().decode(await cli('html'))).toBe('<html>portable</html>')
    expect(createMarkdownImageSurface).toHaveBeenCalledExactlyOnceWith('CLI unsaved snapshot')
    expect(dispose).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
  },
)

it.each(['cancel', 'surface', 'serialize', 'write'])(
  'releases the HTML surface and retained resources after %s',
  async (outcome) => {
    const release = vi.fn()
    const dispose = vi.fn()
    const invoke = vi.fn(async () => {
      if (outcome === 'write') throw new Error('Write failed')
    })
    const toast = {
      loading: vi.fn(() => 'loading'),
      dismiss: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    }
    const exportHtml = runInNewContext(compiledUi, {
      active: true,
      id: 'file',
      getFileObject: () => ({ name: 'note.md' }),
      remoteImages: { retain: () => release },
      editorWrapperRef: { current: null },
      editorSnapshotRegistry: { flushForRead: vi.fn() },
      useEditorStore: { getState: () => ({ getEditorContent: () => 'snapshot' }) },
      save: async () => (outcome === 'cancel' ? null : '/export.html'),
      t: (key: string) => key,
      toast,
      fileTypeConfig: { type: 'markdown' },
      createMarkdownImageSurface: async () => {
        if (outcome === 'surface') throw new Error('Render failed')
        return { element: document.createElement('div'), dispose }
      },
      getFolderPathFromPath: () => '/notes',
      exportHtmlDocument: async () => {
        if (outcome === 'serialize') throw new Error('Unavailable image')
        return 'html'
      },
      invoke,
    }) as () => Promise<void>
    await exportHtml()
    expect(release).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledTimes(['cancel', 'surface'].includes(outcome) ? 0 : 1)
    expect(invoke).toHaveBeenCalledTimes(outcome === 'write' ? 1 : 0)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(outcome === 'cancel' ? 0 : 1)
  },
)

it('keeps the non-Markdown HTML renderer available', async () => {
  const exportHtml = vi.fn(async () => '<p>Other document</p>')
  const wait = vi.fn()
  const release = vi.fn()
  const element = document.createElement('div')
  const serialize = vi.fn(async () => '<html>Other document</html>')
  const render = runInNewContext(compiledCli, {
    automationHandleRef: { current: { readContent: () => 'Other document' } },
    currentViewType: 'sourceCode',
    isCapricornView,
    fileTypeConfig: { type: 'text' },
    remoteImages: { retain: () => release },
    editorRef: { current: { exportHtml } },
    editorWrapperRef: { current: element },
    waitForEditorResourcesForExport: wait,
    exportHtmlDocument: serialize,
    curFile: { name: 'note.txt' },
    getFolderPathFromPath: () => undefined,
    TextEncoder,
  }) as (format: string) => Promise<Uint8Array>
  expect(new TextDecoder().decode(await render('html'))).toContain('Other document')
  expect(wait).toHaveBeenCalledOnce()
  expect(exportHtml).toHaveBeenCalledOnce()
  expect(release).toHaveBeenCalledOnce()
})
