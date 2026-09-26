import { describe, expect, it } from 'vitest'
import { typographyOverrides } from './preferences'

describe('personal typography precedence', () => {
  const preferences = {
    editor_root_font_family: 'Open Sans',
    editor_code_font_family: 'Fira Code',
    editor_root_font_size: 15,
    editor_root_line_height: '1.6',
  }
  it('honors explicit values even when they match older defaults', () => {
    expect(typographyOverrides(preferences)).toEqual({
      'font.editor.family': '"Open Sans"',
      'font.code.family': '"Fira Code"',
      'font.editor.size': '15px',
      'font.editor.lineHeight': '1.6',
    })
  })
  it('lets theme typography apply without deleting personal preferences', () => {
    expect(typographyOverrides({ ...preferences, theme_use_personal_typography: false })).toEqual(
      {},
    )
    expect(
      typographyOverrides({ ...preferences, theme_use_personal_typography: true })[
        'font.editor.size'
      ],
    ).toBe('15px')
  })
})
