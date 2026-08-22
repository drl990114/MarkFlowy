import { describe, expect, it } from 'vitest'
import {
  markflowyDarkTheme,
  markflowyLightTheme,
} from '../../../packages/theme/src/theme-token/markflowy'

describe('default MarkFlowy palettes', () => {
  it('keeps the macOS Classic light surface hierarchy', () => {
    expect(markflowyLightTheme).toMatchObject({
      accentColor: '#1F6AE2',
      bgColor: '#FFFFFF',
      borderColor: '#D2D2D2',
      contextMenuBgColor: '#F7F7F7',
      contextMenuBgColorHover: '#D0D0D0',
      editorTabActiveBgColor: '#FFFFFF',
      editorTabBgColor: '#E9E9E9',
      hoverColor: '#D7D5D577',
      labelFontColor: '#6D6D6D',
      sideBarBgColor: '#F9F9F9',
      statusBarBgColor: '#E9E9E9',
      titleBarBgColor: '#FEFEFE',
    })
  })

  it('keeps the macOS Classic dark surface hierarchy', () => {
    expect(markflowyDarkTheme).toMatchObject({
      bgColor: '#131313',
      borderColor: '#404040',
      contextMenuBgColor: '#1E1D1E',
      contextMenuBgColorHover: '#353436',
      editorTabActiveBgColor: '#131313',
      editorTabBgColor: '#232323',
      hoverColor: '#353436',
      labelFontColor: '#8F8F8F',
      sideBarBgColor: '#1E1D1E',
      statusBarBgColor: '#272727',
      titleBarBgColor: '#323232',
    })
  })

  it('uses solid scrollbar thumbs so the reference colors remain discoverable', () => {
    expect(markflowyLightTheme.scrollbarThumbColor).toBe('#C8C8C8')
    expect(markflowyDarkTheme.scrollbarThumbColor).toBe('#4C4D4D')
  })
})
