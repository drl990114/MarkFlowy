import { ZenModeButton } from '@/components/StatusBar/ZenModeButton'

interface ZenModeControlsProps {
  active: boolean
}

export function ZenModeControls({ active }: ZenModeControlsProps) {
  if (!active) return null

  return (
    <div
      className='absolute right-3 top-3 z-10 rounded-sm bg-background'
      data-mf-zen-mode-controls=''
    >
      <ZenModeButton />
    </div>
  )
}
