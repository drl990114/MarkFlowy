import { LanguageDescription } from '@codemirror/language'
import { languages as codeMirrorLanguages } from '@codemirror/language-data'

// Share one catalog across the picker, editor and HTML preview. MATLAB uses
// CodeMirror's existing Octave lexer without loading another parser up front.
export const languages = codeMirrorLanguages.flatMap((language) =>
  language.name === 'Octave'
    ? [
        LanguageDescription.of({
          name: 'MATLAB',
          load: () => language.load(),
        }),
        language,
      ]
    : [language],
)
