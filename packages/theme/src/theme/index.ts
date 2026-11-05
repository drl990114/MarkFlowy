export * from './darken-colors'

import type { CreateThemeOptions } from '@drl990114/codemirror-themes'
import type { ThemeOverrides } from '../semantic/registry'
import { tokyoNightTheme } from './tokyo-night'
import {
  common,
  desktopDarkTheme as styledDarkTheme,
  gitbookTheme as styledGitBookTheme,
  githubDarkTheme as styledGitHubDarkTheme,
  githubLightTheme as styledGitHubLightTheme,
  desktopLightTheme as styledLightTheme,
  nordTheme as styledNordTheme,
  sepiaTheme as styledSepiaTheme,
} from '../theme-token'

export type ThemeColors = typeof lightTheme
export type ScThemeProps = { theme: ThemeColors }

export type MfTheme = {
  /**
   * should be a unique name
   * @example light
   */
  name: string
  /**
   * light or dark for lib. e.g. mui
   */
  mode: 'light' | 'dark'
  /**
   * Replace styled constants
   */
  styledConstants: Partial<typeof styledLightTheme>
  /** Semantic overrides supplement legacy colors for editors and theme copies. */
  tokens?: ThemeOverrides
  /**
   * Codemirror theme.
   */
  codemirrorTheme?: CreateThemeOptions
  /**
   * @example
   * .example {
   *    color: blue;
   * }
   */
  globalStyleText?: string
}

export { common, tokyoNightTheme }

export const lightTheme: MfTheme = {
  name: 'MarkFlowy Light',
  mode: 'light',
  styledConstants: styledLightTheme,
}

export const darkTheme: MfTheme = {
  name: 'MarkFlowy Dark',
  mode: 'dark',
  styledConstants: styledDarkTheme,
}

export const githubLightTheme: MfTheme = {
  name: 'GitHub Light',
  mode: 'light',
  styledConstants: styledGitHubLightTheme,
}

export const githubDarkTheme: MfTheme = {
  name: 'GitHub Dark',
  mode: 'dark',
  styledConstants: styledGitHubDarkTheme,
}

export const gitbookTheme: MfTheme = {
  name: 'GitBook',
  mode: 'light',
  styledConstants: styledGitBookTheme,
}

export const sepiaTheme: MfTheme = {
  name: 'Sepia',
  mode: 'light',
  styledConstants: styledSepiaTheme,
}

export const nordTheme: MfTheme = {
  name: 'Nord',
  mode: 'dark',
  styledConstants: styledNordTheme,
}

export const builtInThemes: MfTheme[] = [
  lightTheme,
  darkTheme,
  githubLightTheme,
  githubDarkTheme,
  gitbookTheme,
  sepiaTheme,
  nordTheme,
  tokyoNightTheme,
]

