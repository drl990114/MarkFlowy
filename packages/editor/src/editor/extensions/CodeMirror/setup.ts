// Copied from https://github.com/codemirror/basic-setup/blob/main/src/basic-setup.ts

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { lintKeymap } from '@codemirror/lint'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import type { Extension } from '@codemirror/state'
import { EditorState } from '@codemirror/state'
import {
  crosshairCursor,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  highlightWhitespace,
  highlightTrailingWhitespace,
  keymap,
  lineNumbers,
} from '@codemirror/view'

// (The superfluous function calls around the list of extensions work
// around current limitations in tree-shaking software.)

/// This is an extension value that just pulls together a number of
/// extensions that you might want in a basic editor. It is meant as a
/// convenient helper to quickly set up CodeMirror without installing
/// and importing a lot of separate packages.
///
/// Specifically, it includes...
///
///  - [the default command bindings](#commands.defaultKeymap)
///  - [line numbers](#view.lineNumbers)
///  - [special character highlighting](#view.highlightSpecialChars)
///  - [the undo history](#commands.history)
///  - [a fold gutter](#language.foldGutter)
///  - [custom selection drawing](#view.drawSelection)
///  - [drop cursor](#view.dropCursor)
///  - [multiple selections](#state.EditorState^allowMultipleSelections)
///  - [reindentation on input](#language.indentOnInput)
///  - [the default highlight style](#language.defaultHighlightStyle) (as fallback)
///  - [bracket matching](#language.bracketMatching)
///  - [bracket closing](#autocomplete.closeBrackets)
///  - [autocompletion](#autocomplete.autocompletion)
///  - [rectangular selection](#view.rectangularSelection) and [crosshair cursor](#view.crosshairCursor)
///  - [active line highlighting](#view.highlightActiveLine)
///  - [active line gutter highlighting](#view.highlightActiveLineGutter)
///  - [selection match highlighting](#search.highlightSelectionMatches)
///  - [search](#search.searchKeymap)
///  - [linting](#lint.lintKeymap)
///
/// (You'll probably want to add some language package to your setup
/// too.)
///
/// This extension does not allow customization. The idea is that,
/// once you decide you want to configure your editor more precisely,
/// you take this package's source (which is just a bunch of imports
/// and an array literal), copy it into your own code, and adjust it
/// as desired.
export const sourceSetup: Extension = (() => [
  highlightSpecialChars(),
  history(),
  foldGutter(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  autocompletion(),
  crosshairCursor(),
  highlightSelectionMatches(),
  keymap.of([
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
])()

/// A minimal set of extensions to create a functional editor. Only
/// includes [the default keymap](#commands.defaultKeymap), [undo
/// history](#commands.history), [special character
/// highlighting](#view.highlightSpecialChars), [custom selection
/// drawing](#view.drawSelection), and [default highlight
/// style](#language.defaultHighlightStyle).
export const minimalSetup: Extension = (() => [
  dropCursor(),

  highlightSpecialChars(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  autocompletion(),
  crosshairCursor(),
  highlightSelectionMatches(),
  keymap.of([...defaultKeymap]),
])()

export type CodemirrorOptions = {
  lineWrapping?: boolean
  /** Boolean values remain supported for existing integrations. */
  lineNumbers?: boolean | 'off' | 'all' | 'sparse'
  indentStyle?: 'spaces' | 'tabs'
  indentSize?: 2 | 4 | 8
  autoCloseBrackets?: boolean
  highlightActiveLine?: boolean
  whitespace?: 'off' | 'trailing' | 'all'
}

export type CodemirrorSettingsProfile = 'source' | 'embedded' | 'frontmatter'

const whitespaceTheme = EditorView.theme({
  '.cm-highlightSpace': {
    backgroundImage:
      'radial-gradient(circle at 50% 55%, color-mix(in srgb, currentColor 40%, transparent) 20%, transparent 5%)',
  },
  '.cm-highlightTab': { backgroundImage: 'none', position: 'relative' },
  '.cm-highlightTab::before': {
    content: "'→'",
    position: 'absolute',
    left: '0',
    opacity: '0.4',
    pointerEvents: 'none',
  },
  '.cm-trailingSpace': { backgroundColor: 'color-mix(in srgb, currentColor 15%, transparent)' },
})

/** Mutable presentation/input extensions, separate from history and language state. */
export const getCodemirrorSettingsExtensions = (
  options: CodemirrorOptions = {},
  profile: CodemirrorSettingsProfile = 'embedded',
): Extension[] => {
  const source = profile === 'source'
  const wrapping = options.lineWrapping ?? source
  const numbers =
    options.lineNumbers ?? (source ? 'sparse' : profile === 'frontmatter' ? 'off' : 'all')
  const activeLine = options.highlightActiveLine ?? source
  const res: Extension[] = [whitespaceTheme]

  if (wrapping) res.push(EditorView.lineWrapping)
  if (numbers !== false && numbers !== 'off') {
    res.push(
      lineNumbers({
        formatNumber:
          numbers === 'sparse'
            ? (line) => (line === 1 || line % 10 === 0 ? String(line) : '')
            : undefined,
      }),
    )
  }
  if (activeLine) res.push(highlightActiveLine(), highlightActiveLineGutter())
  if (options.autoCloseBrackets !== false) {
    res.push(closeBrackets())
    // Embedded editors historically delete only the opening character.
    // Preserve that behavior; the source profile owns pair deletion.
    if (source) res.push(keymap.of(closeBracketsKeymap))
  }
  // CodeMirror's default display width is four columns, while its default
  // indentation unit is two spaces. Preserve both until a width is selected.
  res.push(EditorState.tabSize.of(options.indentSize ?? 4))
  res.push(
    indentUnit.of(
      options.indentStyle === 'tabs' && profile !== 'frontmatter'
        ? '\t'
        : ' '.repeat(options.indentSize ?? 2),
    ),
  )
  if (options.whitespace === 'all') res.push(highlightWhitespace())
  else if (options.whitespace === 'trailing') res.push(highlightTrailingWhitespace())
  return res
}

// Keep the standalone convenience setup compatible with existing consumers.
export const basicSetup: Extension = [...getCodemirrorSettingsExtensions({}, 'source'), sourceSetup]

export const getSetupByCodemirrorOptions = (options: CodemirrorOptions): Extension[] => [
  minimalSetup,
  ...getCodemirrorSettingsExtensions(options),
]

export { EditorView } from '@codemirror/view'
