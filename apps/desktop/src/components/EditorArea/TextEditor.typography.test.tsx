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
import { EditorViewType } from '@/constants/editorViewType'

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
  'editorSourceFontSize',
  'editorSourceLineHeight',
  'sourceFontSize',
  'sourceLineHeight',
  'rootLineHeight',
  'editorProps',
  'printStyleToken',
  'themeFontSize',
  'wysiwygRootLineHeight',
  'linkEditMode',
  'editorPlaceholder',
  'codeBlockLineWrapping',
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
  function Harness({ settings, keymap, semanticTheme, onOptions, viewType = EditorViewType.WYSIWYG, isHtml = false }) {
    const currentViewType = viewType;
    const useAppSettingStore = (selector) => selector({ settingData: settings });
    const useEditorKeybindingStore = (selector) => selector({
      editorKeybingMap: keymap ?? emptyKeymap,
      editorKeybindingsLoaded: keymap !== undefined,
    });
    ${statements.map((node) => node.getText(source)).join('\n')}
    onOptions(capricornRuntimeOptions, editorProps, printStyleToken);
    return null;
  }
  Harness;
`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText
const Harness = runInNewContext(compiled, {
  useMemo,
  curFile: { id: 'note' },
  content: 'Example',
  delegate: undefined,
  id: 'typography-test',
  fileTypeConfig: {},
  sourceCodeEditorSpellcheck: false,
  EditorViewType,
  editorColorScheme: 'light',
  editorTypewriterScroll: false,
  externalChangeResolving: false,
  savePathReserved: false,
  wysiwygEditorSpellcheck: true,
  getOrCreateDelegateOptions: () => ({}),
  capricornLocalization: {},
  capricornClipboard: {},
  snippetOptions: { items: [] },
  handleCapricornClipboardResult: vi.fn(),
  capricornClipboardCommands,
  createCapricornKeybindingConfiguration,
  emptyKeymap: {},
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS: {},
}) as ComponentType<{
  settings: {
    editor_root_font_size?: number
    editor_root_line_height?: string
    editor_source_font_size?: number
    editor_source_line_height?: string
    editor_link_edit_mode?: 'popover' | 'markdown'
    editor_placeholder?: boolean
    wysiwyg_editor_codemirror_line_wrap?: boolean
  }
  keymap?: Record<string, string>
  viewType?: (typeof EditorViewType)[keyof typeof EditorViewType]
  isHtml?: boolean
  semanticTheme?: {
    'font.editor.size': string
    'font.editor.lineHeight': string
    'font.source.size'?: string
    'font.source.lineHeight'?: string
  }
  onOptions: (options: CapricornRuntimeOptions) => void
}>

afterEach(cleanup)

describe('TextEditor Capricorn typography settings', () => {
  it('forwards the existing code wrap setting and restores its default when unset', () => {
    const onOptions = vi.fn()
    const { rerender } = render(<Harness settings={{}} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].codeBlockLineWrapping).toBe(true)
    rerender(
      <Harness settings={{ wysiwyg_editor_codemirror_line_wrap: false }} onOptions={onOptions} />,
    )
    expect(onOptions.mock.lastCall?.[0].codeBlockLineWrapping).toBe(false)
    rerender(
      <Harness settings={{ wysiwyg_editor_codemirror_line_wrap: true }} onOptions={onOptions} />,
    )
    expect(onOptions.mock.lastCall?.[0].codeBlockLineWrapping).toBe(true)
    rerender(<Harness settings={{}} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].codeBlockLineWrapping).toBe(true)
  })

  it('forwards link editing mode changes and restores the default when unset', () => {
    const onOptions = vi.fn()
    const { rerender } = render(<Harness settings={{}} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].linkEditMode).toBe('popover')

    rerender(<Harness settings={{ editor_link_edit_mode: 'markdown' }} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].linkEditMode).toBe('markdown')

    rerender(<Harness settings={{}} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].linkEditMode).toBe('popover')
  })

  it('forwards the placeholder switch and reacts when it changes', () => {
    const onOptions = vi.fn()
    const { rerender } = render(
      <Harness settings={{ editor_placeholder: false }} onOptions={onOptions} />,
    )
    expect(onOptions.mock.lastCall?.[0].placeholder).toEqual({ enabled: false })
    rerender(<Harness settings={{ editor_placeholder: true }} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].placeholder).toEqual({ enabled: true })
  })
  it('subscribes to shortcut changes and includes them in the memoized runtime options', () => {
    const onOptions = vi.fn()
    const { rerender } = render(<Harness settings={{}} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].keybindingConfiguration.customizations).toEqual([
      { type: 'disable', targetRuleId: 'editor.find.open.default' },
    ])
    rerender(<Harness settings={{}} keymap={{ toggleStrong: 'mod-Alt-b' }} onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[0].keybindingConfiguration.customizations).toContainEqual({
      type: 'replace',
      targetRuleId: 'editor.format.bold.default',
      keys: ['mod+Alt+b'],
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
    expect(onOptions.mock.lastCall?.[0].style).toMatchObject({
      fontSize: '16px',
      lineHeight: '1.7',
    })

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
        fontSize: `${fontSize}px`,
        lineHeight,
        '--cap-code-font-size': `calc(${fontSize}px * 0.875)`,
        '--cap-editor-content-width': 'var(--mf-reader-content-width)',
      })
    }
  })
  it('uses resolved theme typography, including relative CSS lengths', () => {
    const onOptions = vi.fn()
    const { rerender } = render(
      <Harness
        settings={{}}
        semanticTheme={{ 'font.editor.size': '1.2rem', 'font.editor.lineHeight': '1.9' }}
        onOptions={onOptions}
      />,
    )
    expect(onOptions.mock.lastCall?.[0].style).toMatchObject({
      fontSize: '1.2rem',
      lineHeight: '1.9',
      '--cap-code-font-size': 'calc(1.2rem * 0.875)',
    })
    rerender(
      <Harness
        settings={{}}
        semanticTheme={{ 'font.editor.size': '18px', 'font.editor.lineHeight': '1.6' }}
        onOptions={onOptions}
      />,
    )
    expect(onOptions.mock.lastCall?.[0].style).toMatchObject({
      fontSize: '18px',
      lineHeight: '1.6',
    })
  })
  it('updates source typography without changing document typography across modes', () => {
    const onOptions = vi.fn()
    const { rerender } = render(
      <Harness settings={{}} viewType={EditorViewType.SOURCECODE} onOptions={onOptions} />,
    )
    expect(onOptions.mock.lastCall?.[1].styleToken).toMatchObject({
      rootFontSize: '15px',
      rootLineHeight: '1.6',
    })
    const settings = {
      editor_root_font_size: 18,
      editor_root_line_height: '1.8',
      editor_source_font_size: 14,
      editor_source_line_height: '1.5',
    }
    rerender(
      <Harness settings={settings} viewType={EditorViewType.SOURCECODE} onOptions={onOptions} />,
    )
    expect(onOptions.mock.lastCall?.[1].styleToken).toMatchObject({
      rootFontSize: '14px',
      rootLineHeight: '1.5',
    })
    expect(onOptions.mock.lastCall?.[0].style).toMatchObject({
      fontSize: '18px',
      lineHeight: '1.8',
    })
    expect(onOptions.mock.lastCall?.[2]).toMatchObject({
      rootFontSize: '18px',
      rootLineHeight: '1.8',
    })
    rerender(
      <Harness settings={settings} viewType={EditorViewType.PREVIEW} onOptions={onOptions} />,
    )
    expect(onOptions.mock.lastCall?.[1].styleToken).toMatchObject({
      rootFontSize: '18px',
      rootLineHeight: '1.8',
    })
    rerender(<Harness settings={settings} isHtml onOptions={onOptions} />)
    expect(onOptions.mock.lastCall?.[1].styleToken.rootFontSize).toBe('14px')
  })

  it('uses source theme typography independently of document theme typography', () => {
    const onOptions = vi.fn()
    render(
      <Harness
        settings={{ editor_source_font_size: 14 }}
        viewType={EditorViewType.SOURCECODE}
        semanticTheme={{
          'font.editor.size': '20px',
          'font.editor.lineHeight': '1.8',
          'font.source.size': '1rem',
          'font.source.lineHeight': '1.5',
        }}
        onOptions={onOptions}
      />,
    )
    expect(onOptions.mock.lastCall?.[1].styleToken).toMatchObject({
      rootFontSize: '1rem',
      rootLineHeight: '1.5',
    })
  })
})
