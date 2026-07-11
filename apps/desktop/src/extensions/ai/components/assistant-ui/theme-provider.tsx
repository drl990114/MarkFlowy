import { useEffect, useMemo, type CSSProperties, type PropsWithChildren } from 'react'
import Color from 'color'
import { useTheme } from 'styled-components'
import useThemeStore from '@/stores/useThemeStore'
import { desktopDarkTheme, desktopLightTheme } from '@markflowy/theme'
import '../../assistant-ui.css'
import { TooltipProvider } from '../ui/tooltip'
import { cn } from '../lib/cn'

type AssistantUICSSProperties = CSSProperties & Record<`--aui-${string}`, string>

function getReadableForeground(background: string, light: string, dark: string) {
  try {
    const surface = Color(background)
    return surface.contrast(Color(light)) >= surface.contrast(Color(dark)) ? light : dark
  } catch {
    return light
  }
}

export type AssistantUIThemeProviderProps = PropsWithChildren<{
  className?: string
}>

/**
 * Maps MarkFlowy's active styled-components theme to isolated assistant-ui
 * tokens. Variables are mirrored to documentElement while mounted because
 * Radix popovers and tooltips render in a body portal.
 */
export function AssistantUIThemeProvider({ children, className }: AssistantUIThemeProviderProps) {
  const theme = useTheme()
  const mode = useThemeStore((state) => state.curTheme.mode)
  const resolvedTheme = useMemo(
    () => ({
      ...(mode === 'dark' ? desktopDarkTheme : desktopLightTheme),
      ...theme,
    }),
    [mode, theme],
  )
  const variables = useMemo<AssistantUICSSProperties>(() => {
    const primaryForeground = getReadableForeground(
      resolvedTheme.accentColor,
      resolvedTheme.white,
      resolvedTheme.bgColor,
    )

    return {
      '--aui-background': resolvedTheme.rightBarBgColor,
      '--aui-foreground': resolvedTheme.primaryFontColor,
      '--aui-foreground-secondary': resolvedTheme.unselectedFontColor,
      '--aui-card': resolvedTheme.bgColor,
      '--aui-card-foreground': resolvedTheme.primaryFontColor,
      '--aui-popover': resolvedTheme.contextMenuBgColor,
      '--aui-popover-foreground': resolvedTheme.primaryFontColor,
      '--aui-tooltip': resolvedTheme.tooltipBgColor,
      '--aui-primary': resolvedTheme.accentColor,
      '--aui-primary-foreground': primaryForeground,
      '--aui-primary-soft': resolvedTheme.accentColorFocused,
      '--aui-secondary': resolvedTheme.buttonBgColor,
      '--aui-secondary-foreground': resolvedTheme.primaryFontColor,
      '--aui-muted': resolvedTheme.tipsBgColor,
      '--aui-muted-foreground': resolvedTheme.labelFontColor,
      '--aui-disabled-foreground': resolvedTheme.disabledFontColor,
      '--aui-accent': resolvedTheme.contextMenuBgColorHover ?? resolvedTheme.hoverColor,
      '--aui-accent-foreground': resolvedTheme.primaryFontColor,
      '--aui-destructive': resolvedTheme.dangerColor,
      '--aui-destructive-foreground': getReadableForeground(
        resolvedTheme.dangerColor,
        resolvedTheme.white,
        resolvedTheme.bgColor,
      ),
      '--aui-success': resolvedTheme.successColor,
      '--aui-warning': resolvedTheme.warnColor,
      '--aui-border': resolvedTheme.borderColor,
      '--aui-input': resolvedTheme.borderColor,
      '--aui-ring': resolvedTheme.borderColorFocused ?? resolvedTheme.accentColor,
      '--aui-shadow-color': resolvedTheme.boxShadowColor,
      '--aui-scrollbar-thumb': resolvedTheme.scrollbarThumbColor,
      '--aui-scrollbar-track': resolvedTheme.scrollbarTrackColor,
      '--aui-radius-sm': resolvedTheme.smallBorderRadius,
      '--aui-radius': resolvedTheme.midBorderRadius,
      '--aui-radius-lg': resolvedTheme.bigBorderRadius,
      '--aui-font-xs': resolvedTheme.fontXs,
      '--aui-font-sm': resolvedTheme.fontSm,
      '--aui-font-base': resolvedTheme.fontBase,
      '--aui-font-lg': resolvedTheme.fontH6,
      '--aui-font-xl': resolvedTheme.fontH5,
      '--aui-font-2xl': resolvedTheme.fontH4,
      '--aui-line-height': resolvedTheme.lineHeightBase,
      '--aui-space-unit': resolvedTheme.spaceXs,
      '--aui-font-sans': resolvedTheme.fontFamily,
      '--aui-font-mono': resolvedTheme.codemirrorFontFamily,
    }
  }, [resolvedTheme])

  useEffect(() => {
    const root = document.documentElement
    const previousMode = root.dataset.auiTheme
    const previousVariables = new Map<string, string>()

    root.dataset.auiTheme = mode
    for (const [variable, value] of Object.entries(variables)) {
      previousVariables.set(variable, root.style.getPropertyValue(variable))
      root.style.setProperty(variable, value)
    }

    return () => {
      if (previousMode === undefined) delete root.dataset.auiTheme
      else root.dataset.auiTheme = previousMode

      for (const [variable, value] of previousVariables) {
        if (value) root.style.setProperty(variable, value)
        else root.style.removeProperty(variable)
      }
    }
  }, [mode, variables])

  return (
    <TooltipProvider delayDuration={350}>
      <div
        className={cn('aui-theme h-full min-h-0 bg-background text-foreground', className)}
        data-aui-theme={mode}
        style={variables}
      >
        {children}
      </div>
    </TooltipProvider>
  )
}
