import { createGlobalStyle } from 'styled-components'

export const DesktopSpecificStyles = createGlobalStyle<{
  $destructiveForeground: string
  $primaryForeground: string
}>`
  :root {
    --mf-surface-app: ${(props) => props.theme.bgColor};
    --mf-surface-titlebar: ${(props) => props.theme.titleBarBgColor};
    --mf-surface-statusbar: ${(props) => props.theme.statusBarBgColor};
    --mf-surface-panel: ${(props) => props.theme.sideBarBgColor};
    --mf-surface-panel-left: ${(props) => props.theme.sideBarBgColor};
    --mf-surface-panel-right: ${(props) => props.theme.rightBarBgColor};
    --mf-surface-elevated: ${(props) => props.theme.dialogBgColor};
    --mf-surface-overlay: ${(props) => props.theme.contextMenuBgColor};
    --mf-surface-tooltip: ${(props) => props.theme.tooltipBgColor};
    --mf-surface-muted: ${(props) => props.theme.tipsBgColor};
    --mf-text-primary: ${(props) => props.theme.primaryFontColor};
    --mf-text-secondary: ${(props) => props.theme.unselectedFontColor};
    /* Keep muted UI copy on the stronger secondary-text channel. */
    --mf-text-muted: ${(props) => props.theme.unselectedFontColor};
    --mf-text-disabled: ${(props) => props.theme.disabledFontColor};
    --mf-titlebar-border: color-mix(
      in srgb,
      ${(props) => props.theme.titleBarBgColor} 84.5%,
      ${(props) => props.theme.primaryFontColor} 15.5%
    );
    --mf-control-surface: ${(props) => props.theme.buttonBgColor};
    --mf-control-hover: ${(props) => props.theme.contextMenuBgColorHover};
    --mf-control-ghost-hover: ${(props) => props.theme.hoverColor};
    --mf-control-titlebar-hover: ${(props) => props.theme.titleBarDefaultHoverColor};
    --mf-control-pressed: color-mix(
      in srgb,
      ${(props) => props.theme.contextMenuBgColorHover} 92%,
      ${(props) => props.theme.primaryFontColor} 8%
    );
    --mf-control-ghost-pressed: ${(props) => props.theme.fileTreeSelectedBgColor};
    --mf-control-selected: ${(props) => props.theme.fileTreeSelectedBgColor};
    --mf-control-border: ${(props) => props.theme.borderColor};
    --mf-control-focus: ${(props) => props.theme.accentColor};
    --mf-motion-duration-fast: 120ms;
    --mf-motion-duration-base: 180ms;
    --mf-motion-duration-overlay: 240ms;
    --mf-motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --mf-motion-ease-in: cubic-bezier(0.4, 0, 1, 1);
    --mf-layer-dock-overlay: 20;
    --mf-layer-dialog: 900;
    --mf-layer-popover: 1000;
    --mf-layer-menu: 1000;
    --mf-layer-select: 1000;
    --mf-layer-tooltip: 1001;
    --mf-background: var(--mf-surface-app);
    --mf-rightbar-background: var(--mf-surface-panel-right);
    --mf-foreground: var(--mf-text-primary);
    --mf-foreground-secondary: var(--mf-text-secondary);
    --mf-card: var(--mf-surface-app);
    --mf-card-foreground: var(--mf-text-primary);
    --mf-dialog: var(--mf-surface-elevated);
    --mf-dialog-overlay: ${(props) => props.theme.dialogBackdropColor};
    --mf-popover: var(--mf-surface-overlay);
    --mf-popover-foreground: var(--mf-text-primary);
    --mf-tooltip: var(--mf-surface-tooltip);
    --mf-primary: ${(props) => props.theme.accentColor};
    --mf-primary-foreground: ${(props) => props.$primaryForeground};
    --mf-primary-soft: ${(props) => props.theme.accentColorFocused};
    --mf-secondary: var(--mf-control-surface);
    --mf-secondary-foreground: var(--mf-text-primary);
    --mf-muted: var(--mf-surface-muted);
    --mf-muted-foreground: var(--mf-text-muted);
    --mf-disabled-foreground: var(--mf-text-disabled);
    --mf-accent: ${(props) => props.theme.contextMenuBgColorHover};
    --mf-accent-foreground: ${(props) => props.theme.primaryFontColor};
    --mf-destructive: ${(props) => props.theme.dangerColor};
    --mf-destructive-foreground: ${(props) => props.$destructiveForeground};
    --mf-success: ${(props) => props.theme.successColor};
    --mf-warning: ${(props) => props.theme.warnColor};
    --mf-border: var(--mf-control-border);
    --mf-input: var(--mf-control-border);
    --mf-ring: var(--mf-control-focus);
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
    --mf-ui-control-hover-bg: var(--mf-control-ghost-hover);
    --mf-ui-control-selected-bg: var(--mf-control-selected);
    --mf-ui-title-bar-height: 34px;
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
    text-rendering: optimizeLegibility;
  }

  @layer components {
    * {
      border-color: ${(props) => props.theme.borderColor};
    }
  }
`

export { GlobalStyles } from '@markflowy/interface'
