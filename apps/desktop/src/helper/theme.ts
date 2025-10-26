import useThemeStore from '@/stores/useThemeStore'
import { darken, lighten } from '@markflowy/theme'

export const colorAdaptiveChange = (
  color: string,
  lightenAmount: number,
  darkenAmount: number,
  options?: {
    opposite?: boolean
  },
) => {
  const themeStore = useThemeStore.getState()

  if (options?.opposite) {
    if (themeStore.curTheme.mode === 'dark') {
      return lighten(color, lightenAmount)
    } else {
      return darken(color, darkenAmount)
    }
  } else {
    if (themeStore.curTheme.mode === 'dark') {
      return darken(color, darkenAmount)
    } else {
      return lighten(color, lightenAmount)
    }
  }
}
