import { markflowyDarkTheme, markflowyLightTheme, webSpecificTokens } from '@markflowy/theme'

/** Shared visual language for Web. Desktop keeps its own theme. */
const lightWebsiteTheme = {
  ...webSpecificTokens,
  ...markflowyLightTheme,
  primaryBg: '#ffffff',
  primaryText: '#0a2540',
  secondaryBg: '#f6f9fc',
  secondaryText: '#425466',
  secondaryFontColor: '#52657a',
  navBackground: 'rgba(255, 255, 255, 0.94)',
  footerBgColor: '#f6f9fc',
  sidebarBackground: '#ffffff',
  bgColor: '#ffffff',
  bgColorSecondary: '#f6f9fc',
  primaryFontColor: '#0a2540',
  unselectedFontColor: '#52657a',
  labelFontColor: '#52657a',
  borderColor: '#e3e9ef',
  accentColor: markflowyLightTheme.accentColor,
  accentColorFocused: markflowyLightTheme.accentColorFocused,
  borderColorFocused: markflowyLightTheme.borderColorFocused,
  webPaper: '#ffffff',
  webPaperWarm: '#f6f9fc',
  webPaperDark: '#edf2f7',
  webSurfaceRaised: '#ffffff',
  webSurfaceHover: '#eef4fc',
  webSurfaceActive: '#e6effd',
  webInk: '#0a2540',
  webInkSoft: '#425466',
  webInkMute: '#52657a',
  webInkFaint: '#65788c',
  webSeal: markflowyLightTheme.accentColor,
  webSealSoft: markflowyLightTheme.accentColor,
  webInkWash: '#8395ad',
  webLine: '#d5dfe9',
  webLineSoft: '#e5ebf1',
  webLineFaint: '#f0f3f7',
  webShadow: '0 24px 60px -24px rgba(10, 37, 64, 0.25)',
  webShadowColor: '#0a2540',
  webOnAccent: '#ffffff',
  webFontSans:
    "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  webFontBody:
    "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
}

const darkWebsiteTheme: typeof lightWebsiteTheme = {
  ...lightWebsiteTheme,
  ...markflowyDarkTheme,
  // Low-chroma graphite surfaces keep brand blue reserved for meaningful accents.
  // Separate page, elevated and interactive levels (Radix/Geist color roles).
  primaryBg: '#141517',
  primaryText: '#edeef0',
  secondaryBg: '#1b1c20',
  secondaryText: '#c0c2c7',
  secondaryFontColor: '#a0a4ad',
  navBackground: 'rgba(20, 21, 23, 0.94)',
  footerBgColor: '#1b1c20',
  sidebarBackground: '#141517',
  bgColor: '#141517',
  bgColorSecondary: '#1b1c20',
  primaryFontColor: '#edeef0',
  unselectedFontColor: '#a0a4ad',
  labelFontColor: '#a0a4ad',
  borderColor: '#373b43',
  accentColor: '#97b5f5',
  accentColorFocused: '#2a3852',
  borderColorFocused: '#97b5f5',
  webPaper: '#141517',
  webPaperWarm: '#1b1c20',
  webPaperDark: '#26282d',
  webSurfaceRaised: '#23252a',
  webSurfaceHover: '#2b2e34',
  webSurfaceActive: '#30343b',
  webInk: '#edeef0',
  webInkSoft: '#c0c2c7',
  webInkMute: '#a0a4ad',
  webInkFaint: '#9da2ab',
  webSeal: '#97b5f5',
  webSealSoft: '#bdd0f6',
  webInkWash: '#7b869b',
  webLine: '#373b43',
  webLineSoft: '#2b2e34',
  webLineFaint: '#202227',
  webShadow: '0 20px 60px -16px rgba(0, 0, 0, 0.55)',
  webShadowColor: '#000000',
  webOnAccent: '#141b2b',
}

export const websiteThemes = { light: lightWebsiteTheme, dark: darkWebsiteTheme }
export type WebThemeMode = keyof typeof websiteThemes

/** Keep editor tokens in the same palette as the surrounding application. */
function createApplicationTheme(theme: typeof lightWebsiteTheme, mode: WebThemeMode) {
  const dark = mode === 'dark'
  const hover = theme.webSurfaceHover
  const selected = dark ? theme.accentColorFocused : theme.webSurfaceActive
  return {
    ...theme,
    fontFamily: theme.webFontSans,
    disabledFontColor: theme.webInkFaint,
    hoverColor: hover,
    titleBarBgColor: theme.webPaper,
    titleBarDefaultHoverColor: theme.webPaperWarm,
    editorTabBgColor: theme.webPaperWarm,
    editorTabActiveBgColor: theme.webPaper,
    editorToolbarBgColor: theme.webPaper,
    sideBarBgColor: theme.webPaperWarm,
    sideBarHeaderBgColor: theme.webPaperWarm,
    rightBarBgColor: theme.webPaper,
    rightBarHeaderBgColor: theme.webPaper,
    statusBarBgColor: theme.webPaper,
    fileTreeSelectedBgColor: selected,
    fileTreeIndentLineColor: theme.webLineSoft,
    tocbarProgressBgColor: theme.webPaperWarm,
    tocbarProgressActiveBgColor: theme.accentColor,
    buttonBgColor: theme.webPaper,
    contextMenuBgColor: theme.webSurfaceRaised,
    contextMenuBgColorHover: hover,
    contextMenuBgColorActive: selected,
    contextMenuSeparatorColor: theme.webLineSoft,
    dialogBgColor: theme.webSurfaceRaised,
    dialogBackdropColor: dark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(10, 37, 64, 0.24)',
    tipsBgColor: theme.webPaperWarm,
    tooltipBgColor: theme.webSurfaceRaised,
    scrollbarTrackColor: 'transparent',
    scrollbarThumbColor: dark ? '#545963' : '#c2cedb',
    boxShadowColor: theme.webShadow,
    nodeSelectedColor: selected,
    blockquoteBorderColor: theme.accentColor,
    blockquoteFontColor: theme.webInkSoft,
    placeholderFontColor: theme.webInkFaint,
    preBgColor: theme.webPaperWarm,
    codeBgColor: theme.webPaperWarm,
    successColor: dark ? '#8dcbb0' : '#087f5b',
    dangerColor: dark ? '#efa0aa' : '#c4324a',
    warnColor: dark ? '#dfc18a' : '#9a6700',
    codemirrorFontFamily: theme.webFontMono,
  }
}

export const applicationThemes = {
  light: createApplicationTheme(lightWebsiteTheme, 'light'),
  dark: createApplicationTheme(darkWebsiteTheme, 'dark'),
}

// Both palettes are present in SSR CSS. Even styled-components and static token
// consumers switch before hydration, as soon as next-themes sets the attribute.
function references<T extends Record<string, string>>(tokens: T): T {
  return Object.fromEntries(Object.keys(tokens).map((key) => [key, `var(--mf-web-${key})`])) as T
}

function declarations(tokens: Record<string, string>) {
  return Object.entries(tokens)
    .map(([key, value]) => `--mf-web-${key}: ${value};`)
    .join('\n')
}

function themeCSS(themes: Record<WebThemeMode, Record<string, string>>) {
  return `
    :root { color-scheme: light; ${declarations(themes.light)} }
    :root[data-mf-theme='dark'] { color-scheme: dark; ${declarations(themes.dark)} }
  `
}

export const websiteTheme = references(lightWebsiteTheme)
export const applicationTheme = references(applicationThemes.light)
export const websiteThemeCSS = themeCSS(websiteThemes)
export const applicationThemeCSS = themeCSS(applicationThemes)
