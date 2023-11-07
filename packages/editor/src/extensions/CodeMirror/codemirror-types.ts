import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import type { ProsemirrorAttributes } from '@remirror/core'

export interface CodeMirrorExtensionOptions {
  /**
   * Whether to hide the decoration.
   *
   * @defaultValue false
   */
  hideDecoration?: boolean;
  /**
   * The CodeMirror extensions to use.
   *
   * @remarks
   *
   * For package size reasons, no CodeMirror extensions are included by default.
   * You might want to install and add the following two extensions:
   *
   * - [`basicSetup`](https://codemirror.net/6/docs/ref/#basic-setup.basicSetup)
   *
   * @defaultValue null
   */
  extensions?: CodeMirrorExtension[] | null;

  /**
   * The name of the node that the codeMirror block should toggle back and forth from.
   *
   * @defaultValue "paragraph"
   */
  toggleName?: string;
}

export interface CodeMirrorExtensionAttributes extends ProsemirrorAttributes {
  /**
   * A string to represent the language matching the language name or alias in
   * [`LanguageDescription`](https://codemirror.net/docs/ref/#language.LanguageDescription)
   *
   * @defaultValue ''
   */
  language?: string;
}
