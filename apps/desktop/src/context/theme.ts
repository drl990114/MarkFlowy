import useThemeStore from "@/stores/useThemeStore"
import type { MfTheme } from "@markflowy/theme"

/**
 * register custom theme
 * @param theme 
 */
export const registerTheme = (theme: MfTheme) => {
  const { insertTheme } = useThemeStore.getState()

  insertTheme(theme)
}
