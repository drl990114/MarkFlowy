import { runInNewContext } from 'node:vm'
import { cleanup, render } from '@testing-library/react'
import { useMemo, type ComponentType } from 'react'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CapricornRuntimeOptions } from './capricornRuntimeAdapter'
import {
  capricornClipboardCommands,
  createCapricornKeybindingConfiguration,
} from './capricornKeybindings'
import textEditorSource from './TextEditor.tsx?raw'

// Exercise the host's real settings selectors, options and memo dependencies
// without mounting file watchers or native services.
const source = ts.createSourceFile(
  'TextEditor.tsx',
  textEditorSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
const editor = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'TextEditor',
)
if (!editor?.body) throw new Error('TextEditor implementation was not found')
const names = new Set([
  'editorRootFontSize',
  'editorRootLineHeight',
  'editorKeybingMap',
  'editorKeybindingsLoaded',
  'capricornRuntimeOptions',
])
const statements = editor.body.statements.filter(
  (node) =>
    ts.isVariableStatement(node) &&
    names.has(node.declarationList.declarations[0].name.getText(source)),
)
if (statements.length !== names.size)
  throw new Error('Editor typography declarations were not found')
const compiled = ts.transpileModule(
  `
  function Harness({ settings, keymap, onOptions }) {
    const useAppSettingStore = (selector) => selector({ settingData: settings });
    const useEditorKeybindingStore = (selector) => selector({
      editorKeybingMap: keymap ?? emptyKeymap,
      editorKeybindingsLoaded: keymap !== undefined,
    });
    ${statements.map((node) => node.getText(source)).join('\n')}
    onOptions(capricornRuntimeOptions);
    return null;
  }
  Harness;
`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText
const Harness = runInNewContext(compiled, {
  useMemo,
  curFile: { id: 'note' },
  editorColorScheme: 'light',
  editorTypewriterScroll: false,
  externalChangeResolving: false,
  savePathReserved: false,
  wysiwygEditorSpellcheck: true,
  getOrCreateDelegateOptions: () => ({}),
  capricornLocalization: {},
  capricornClipboard: {},
  handleCapricornClipboardResult: vi.fn(),
  capricornClipboardCommands,
  createCapricornKeybindingConfiguration,
  emptyKeymap: {},
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS: {},
}) as ComponentType<{
  settings: { editor_root_font_size?: number; editor_root_line_height?: string }
  keymap?: Record<string, string>
  onOptions: (options: CapricornRuntimeOptions) => void
}>

afterEach(cleanup)

describe('TextEditor Capricorn typography settings', () => {
  it('subscribes to shortcut changes and includes them in the memoized runtime options', () => {
    const onOptions = vi.fn()
    const { rerender } = render(<Harness settings={{}} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].keybindingConfiguration.customizations).toEqual([])
    rerender(<Harness settings={{}} keymap={{ toggleStrong: 'mod-Alt-b' }} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].keybindingConfiguration.customizations).toContainEqual({
      type: 'replace',
      targetRuleId: 'editor.format.bold.default',
      keys: 'mod+Alt+b',
    })
    rerender(<Harness settings={{}} keymap={{}} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].keybindingConfiguration.customizations).toContainEqual({
      type: 'disable',
      targetRuleId: 'editor.format.bold.default',
    })
  })
  it('updates size and line height independently and honors values formerly treated as defaults', () => {
    const onOptions = vi.fn()
    const { rerender } = render(<Harness settings={{}} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].style).toMatchObject({ fontSize: 16, lineHeight: '1.7' })

    for (const [fontSize, lineHeight] of [
      [24, '1.8'],
      [15, '1.8'],
      [15, '1.6'],
    ] as const) {
      rerender(
        <Harness
          settings={{ editor_root_font_size: fontSize, editor_root_line_height: lineHeight }}
          onOptions={onOptions}
        />,
      )
      expect(onOptions.mock.lastCall?.[0].style).toEqual({
        fontSize,
        lineHeight,
        '--cap-code-font-size': `${fontSize * 0.875}px`,
      })
    }
  })
})
