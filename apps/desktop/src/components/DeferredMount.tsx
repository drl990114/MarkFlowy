import { useState, type ReactNode } from 'react'

/** Delay a hidden surface's first mount, then preserve its state when hidden. */
export function DeferredMount({ visible, children }: { visible: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(visible)
  if (visible && !mounted) setMounted(true)
  return visible || mounted ? children : null
}
