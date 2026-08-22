import { markflowyLightTheme } from '../../../packages/theme/src/theme-token/markflowy'
import { sepiaTheme } from '../../../packages/theme/src/theme-token/sepia'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DesktopSpecificStyles } from './globalStyles'

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('DesktopSpecificStyles theme semantics', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('keeps menu, ghost, titlebar, and pressed surfaces independent', () => {
    const theme = {
      ...markflowyLightTheme,
      contextMenuBgColorHover: '#303030',
      fileTreeSelectedBgColor: '#404040',
      hoverColor: '#101010',
      titleBarDefaultHoverColor: '#202020',
    }

    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <DesktopSpecificStyles
            $destructiveForeground='#ffffff'
            $primaryForeground='#ffffff'
          />
        </ThemeProvider>,
      )
    })
    const styles = document.head.textContent?.replaceAll(/\s/g, '')

    expect(styles).toContain('--mf-control-hover:#303030')
    expect(styles).toContain('--mf-control-ghost-hover:#101010')
    expect(styles).toContain('--mf-control-titlebar-hover:#202020')
    expect(styles).toContain('--mf-control-ghost-pressed:#404040')
  })

  it('keeps Sepia chrome hover visible when its menu hover matches the chrome surface', () => {
    act(() => {
      root.render(
        <ThemeProvider theme={sepiaTheme}>
          <DesktopSpecificStyles
            $destructiveForeground='#ffffff'
            $primaryForeground='#ffffff'
          />
        </ThemeProvider>,
      )
    })
    const styles = document.head.textContent?.replaceAll(/\s/g, '')

    expect(sepiaTheme.contextMenuBgColorHover).toBe(sepiaTheme.statusBarBgColor)
    expect(sepiaTheme.hoverColor).not.toBe(sepiaTheme.statusBarBgColor)
    expect(styles).toContain(`--mf-control-hover:${sepiaTheme.contextMenuBgColorHover}`)
    expect(styles).toContain(`--mf-control-ghost-hover:${sepiaTheme.hoverColor}`)
    expect(styles).toContain('--mf-ui-control-hover-bg:var(--mf-control-ghost-hover)')
  })
})
