import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import infoBarSource from './EditorInfoBar.tsx?raw'
import moreActionsSource from './editorToolBar/WysiwygToolbar/components/MoreActions.tsx?raw'
import menuListSource from './editorToolBar/components/MenuList.tsx?raw'

// Execute the actual action callbacks without mounting unrelated editor UI or
// invoking native services. The read failure must precede every side effect.
function readAction(sourceText: string, name: string, bindings: Record<string, unknown>) {
  const source = ts.createSourceFile(
    'action.tsx',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let callback: ts.Expression | undefined
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === name &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(source) === 'useCallback'
    )
      callback = node.initializer.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!callback) throw new Error(`Missing action callback: ${name}`)
  const compiled = ts.transpileModule(`(${callback.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return runInNewContext(compiled, { Error, ...bindings }) as (argument: string) => Promise<void>
}

const actions = [
  { label: 'info conversion', source: infoBarSource, name: 'convertText' },
  { label: 'menu conversion', source: menuListSource, name: 'convertText' },
  { label: 'more conversion', source: moreActionsSource, name: 'convertText' },
]

function createActionHarness(source: string, name: string, failure: unknown) {
  const getEditorContent = vi.fn((): string => {
    throw failure
  })
  const bindings = {
    getEditorContent,
    curFile: { id: 'file' },
    targetEditorId: 'file',
    toast: { error: vi.fn() },
    invoke: vi.fn(async () => ({ code: 'success', content: 'converted' })),
    bus: { emit: vi.fn() },
    FileResultCode: { Success: 'success' },
  }
  const action = readAction(source, name, bindings)
  return { action, ...bindings }
}

describe('editor actions require a readable current snapshot', () => {
  it.each(actions)(
    '$label stops before side effects and succeeds after composition commits',
    async ({ source, name }) => {
      const message = 'Finish composing before using this action.'
      const harness = createActionHarness(source, name, new Error(message))
      await expect(harness.action('zh-Hans')).resolves.toBeUndefined()
      expect(harness.getEditorContent).toHaveBeenCalledWith('file')
      expect(harness.toast.error).toHaveBeenCalledWith(message)
      expect(harness.invoke).not.toHaveBeenCalled()
      expect(harness.bus.emit).not.toHaveBeenCalled()

      harness.getEditorContent.mockReturnValue('latest committed Markdown')
      await harness.action('zh-Hans')
      expect(harness.toast.error).toHaveBeenCalledOnce()
      expect(harness.invoke).toHaveBeenCalledWith('convert_text', {
        text: 'latest committed Markdown',
        variant: 'zh-Hans',
      })
      expect(harness.bus.emit).toHaveBeenCalledWith('editor_set_content', undefined, 'converted')
    },
  )

  it.each(actions)(
    '$label reports a non-Error read failure without running the action',
    async ({ source, name }) => {
      const harness = createActionHarness(source, name, 'Snapshot unavailable')
      await expect(harness.action('zh-Hans')).resolves.toBeUndefined()
      expect(harness.toast.error).toHaveBeenCalledWith('Snapshot unavailable')
      expect(harness.invoke).not.toHaveBeenCalled()
      expect(harness.bus.emit).not.toHaveBeenCalled()
    },
  )
})
