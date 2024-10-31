import useThemeStore from '@/stores/useThemeStore'
import { lighten, darken } from '@markflowy/theme'

export const colorAdaptiveChange = (
  color: string,
  lightenAmount: number,
  darkenAmount: number,
) => {
  const themeStore = useThemeStore.getState()

  if (themeStore.curTheme.mode === 'dark') {
    return lighten(color, lightenAmount)
  } else {
    return darken(color, darkenAmount)
  }
}
