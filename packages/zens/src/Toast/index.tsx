import { Toaster } from 'sonner'
import { useComponentThemeMode, useComponentThemeStyle } from '../Theme/components-theme'

export { toast } from 'sonner'
export type Variant = 'default' | 'error' | 'warning' | 'info' | 'success'

export function Notifications() {
  const style = useComponentThemeStyle({
    borderColor: 'var(--mf-border)',
    borderRadius: 'var(--mf-radius-sm)',
    color: 'var(--mf-foreground)',
    background: 'var(--mf-background)',
    fontFamily: 'var(--mf-ui-font-family)',
  })
  const mode = useComponentThemeMode()
  return (
    <Toaster theme={mode} expand={false} closeButton toastOptions={{ style, duration: 5000 }} />
  )
}
