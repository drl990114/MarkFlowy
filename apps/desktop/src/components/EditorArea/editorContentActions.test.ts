import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import infoBarSource from './EditorInfoBar.tsx?raw'
import aiButtonSource from './editorToolBar/WysiwygToolbar/components/AIButton.tsx?raw'
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
  { label: 'info summary', source: infoBarSource, name: 'fetchCurFileSummary', kind: 'summary' },
  {
    label: 'info translation',
    source: infoBarSource,
    name: 'fetchCurFileTranslate',
    kind: 'translation',
  },
  { label: 'info conversion', source: infoBarSource, name: 'convertText', kind: 'conversion' },
  {
    label: 'toolbar summary',
    source: aiButtonSource,
    name: 'fetchCurFileSummary',
    kind: 'summary',
  },
  {
    label: 'toolbar translation',
    source: aiButtonSource,
    name: 'fetchCurFileTranslate',
    kind: 'translation',
  },
  { label: 'menu conversion', source: menuListSource, name: 'convertText', kind: 'conversion' },
  { label: 'more conversion', source: moreActionsSource, name: 'convertText', kind: 'conversion' },
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
    addAppTask: vi.fn(({ promise }: { promise: Promise<string> }) => promise),
    addNewMarkdownFileEdit: vi.fn(),
    summarizeAIText: vi.fn(async () => 'summary'),
    translateAIText: vi.fn(async () => 'translation'),
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
    async ({ source, name, kind }) => {
      const message = 'Finish composing before using this action.'
      const harness = createActionHarness(source, name, new Error(message))
      await expect(harness.action('zh-Hans')).resolves.toBeUndefined()
      expect(harness.getEditorContent).toHaveBeenCalledWith('file')
      expect(harness.toast.error).toHaveBeenCalledWith(message)
      for (const effect of [
        harness.addAppTask,
        harness.addNewMarkdownFileEdit,
        harness.summarizeAIText,
        harness.translateAIText,
        harness.invoke,
        harness.bus.emit,
      ]) {
        expect(effect).not.toHaveBeenCalled()
      }

      harness.getEditorContent.mockReturnValue('latest committed Markdown')
      await harness.action('zh-Hans')
      expect(harness.toast.error).toHaveBeenCalledOnce()
      if (kind === 'summary') {
        expect(harness.summarizeAIText).toHaveBeenCalledWith('latest committed Markdown')
        expect(harness.addNewMarkdownFileEdit).toHaveBeenCalledOnce()
      } else if (kind === 'translation') {
        expect(harness.translateAIText).toHaveBeenCalledWith('latest committed Markdown', 'zh-Hans')
        expect(harness.addNewMarkdownFileEdit).toHaveBeenCalledOnce()
      } else {
        expect(harness.invoke).toHaveBeenCalledWith('convert_text', {
          text: 'latest committed Markdown',
          variant: 'zh-Hans',
        })
        expect(harness.bus.emit).toHaveBeenCalledWith('editor_set_content', undefined, 'converted')
      }
    },
  )

  it.each(actions)(
    '$label reports a non-Error read failure without running the action',
    async ({ source, name }) => {
      const harness = createActionHarness(source, name, 'Snapshot unavailable')
      await expect(harness.action('zh-Hans')).resolves.toBeUndefined()
      expect(harness.toast.error).toHaveBeenCalledWith('Snapshot unavailable')
      expect(harness.addAppTask).not.toHaveBeenCalled()
      expect(harness.invoke).not.toHaveBeenCalled()
      expect(harness.bus.emit).not.toHaveBeenCalled()
    },
  )
})
