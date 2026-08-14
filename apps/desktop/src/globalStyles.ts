import { createGlobalStyle } from 'styled-components'

export const DesktopSpecificStyles = createGlobalStyle<{
  $destructiveForeground: string
  $primaryForeground: string
}>`
  :root {
    --mf-background: ${(props) => props.theme.bgColor};
    --mf-rightbar-background: ${(props) => props.theme.rightBarBgColor};
    --mf-foreground: ${(props) => props.theme.primaryFontColor};
    --mf-foreground-secondary: ${(props) => props.theme.unselectedFontColor};
    --mf-card: ${(props) => props.theme.bgColor};
    --mf-card-foreground: ${(props) => props.theme.primaryFontColor};
    --mf-dialog: ${(props) => props.theme.dialogBgColor};
    --mf-dialog-overlay: ${(props) => props.theme.dialogBackdropColor};
    --mf-popover: ${(props) => props.theme.contextMenuBgColor};
    --mf-popover-foreground: ${(props) => props.theme.primaryFontColor};
    --mf-tooltip: ${(props) => props.theme.tooltipBgColor};
    --mf-primary: ${(props) => props.theme.accentColor};
    --mf-primary-foreground: ${(props) => props.$primaryForeground};
    --mf-primary-soft: ${(props) => props.theme.accentColorFocused};
    --mf-secondary: ${(props) => props.theme.buttonBgColor};
    --mf-secondary-foreground: ${(props) => props.theme.primaryFontColor};
    --mf-muted: ${(props) => props.theme.tipsBgColor};
    --mf-muted-foreground: ${(props) => props.theme.labelFontColor};
    --mf-disabled-foreground: ${(props) => props.theme.disabledFontColor};
    --mf-accent: ${(props) => props.theme.contextMenuBgColorHover};
    --mf-accent-foreground: ${(props) => props.theme.primaryFontColor};
    --mf-destructive: ${(props) => props.theme.dangerColor};
    --mf-destructive-foreground: ${(props) => props.$destructiveForeground};
    --mf-success: ${(props) => props.theme.successColor};
    --mf-warning: ${(props) => props.theme.warnColor};
    --mf-border: ${(props) => props.theme.borderColor};
    --mf-input: ${(props) => props.theme.borderColor};
    --mf-ring: ${(props) => props.theme.accentColor};
    --mf-shadow-color: ${(props) => props.theme.boxShadowColor};
    --mf-scrollbar-thumb: ${(props) => props.theme.scrollbarThumbColor};
    --mf-scrollbar-track: ${(props) => props.theme.scrollbarTrackColor};
    --mf-radius-sm: ${(props) => props.theme.smallBorderRadius};
    --mf-radius: ${(props) => props.theme.midBorderRadius};
    --mf-radius-lg: ${(props) => props.theme.bigBorderRadius};
    --mf-font-xs: ${(props) => props.theme.fontXs};
    --mf-font-sm: ${(props) => props.theme.fontSm};
    --mf-font-base: ${(props) => props.theme.fontBase};
    --mf-font-lg: ${(props) => props.theme.fontH6};
    --mf-font-xl: ${(props) => props.theme.fontH5};
    --mf-font-2xl: ${(props) => props.theme.fontH4};
    --mf-line-height: ${(props) => props.theme.lineHeightBase};
    --mf-ui-font-caption: ${(props) => props.theme.fontXs};
    --mf-ui-font-control: ${(props) => props.theme.fontSm};
    --mf-ui-font-body: ${(props) => props.theme.fontBase};
    --mf-ui-font-title: ${(props) => props.theme.fontH6};
    --mf-ui-font-heading: ${(props) => props.theme.fontH5};
    --mf-space-unit: ${(props) => props.theme.spaceXs};
    --mf-font-sans: ${(props) => props.theme.fontFamily};
    --mf-font-mono: ${(props) => props.theme.codemirrorFontFamily};
    --mf-ui-font-family: ${(props) => props.theme.fontFamily};
    --mf-ui-font-mono: ${(props) => props.theme.codemirrorFontFamily};
    --mf-ui-border-subtle: color-mix(in srgb, ${(props) => props.theme.borderColor} 72%, transparent);
    --mf-ui-border-muted: color-mix(in srgb, ${(props) => props.theme.borderColor} 56%, transparent);
    --mf-ui-control-hover-bg: ${(props) => props.theme.hoverColor};
    --mf-ui-control-selected-bg: ${(props) => props.theme.fileTreeSelectedBgColor};
  }

  html {
    border-radius: 10px;
    overflow: hidden;
    background-color:  ${(props) => props.theme.bgColor};
  }

  body {
    background-color: ${(props) => props.theme.bgColor};
    color: ${(props) => props.theme.primaryFontColor};
    overflow: hidden;
    font-family: var(--mf-ui-font-family);
    font-size: var(--mf-ui-font-control);
    font-optical-sizing: auto;
    line-height: var(--mf-ui-line-height-control);
    letter-spacing: var(--mf-ui-tracking-control);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  @layer components {
    * {
      border-color: ${(props) => props.theme.borderColor};
    }
  }
`

export { GlobalStyles } from '@markflowy/interface'
