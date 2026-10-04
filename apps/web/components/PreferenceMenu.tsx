import { useRouter } from 'next/router'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from 'zens'
import NavButton from './Nav/NavButton'

export interface PreferenceOption<Value extends string> {
  value: Value
  label: string
  icon: ReactNode
}
export interface PreferenceMenuProps<Value extends string> {
  label: string
  icon: ReactNode
  value: Value
  options: readonly PreferenceOption<Value>[]
  onValueChange: (value: Value) => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
}
export default function PreferenceMenu<Value extends string>({
  label,
  icon,
  value,
  options,
  onValueChange,
  disabled,
  className,
  style,
}: PreferenceMenuProps<Value>) {
  const [open, setOpen] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  const focusLastOnOpen = useRef(false)
  const router = useRouter()
  const selectedLabel = options.find((option) => option.value === value)?.label
  useEffect(() => {
    const close = () => setOpen(false)
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])
  return (
    <DropdownMenuRoot open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <NavButton
          type='button'
          className={['mf-preference-trigger', className].filter(Boolean).join(' ')}
          style={style}
          disabled={disabled}
          aria-label={label}
          title={selectedLabel ? `${label}: ${selectedLabel}` : label}
          data-instant={keyboard}
          onPointerDown={() => setKeyboard(false)}
          onKeyDown={(event) => {
            setKeyboard(true)
            // Radix opens on ArrowDown; retain this menu's ArrowUp-to-last shortcut.
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              focusLastOnOpen.current = true
              setOpen(true)
            }
          }}
        >
          <span className='mf-preference-trigger-icon' aria-hidden='true'>
            {icon}
          </span>
        </NavButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={(content) => {
          if (!content || !focusLastOnOpen.current) return
          focusLastOnOpen.current = false
          queueMicrotask(() => {
            if (!content.isConnected) return
            const items = content.querySelectorAll<HTMLElement>(
              '[role="menuitemradio"]:not([data-disabled])',
            )
            items.item(items.length - 1)?.focus()
          })
        }}
        className='mf-preference-menu'
        aria-label={label}
        data-instant={keyboard}
        side='bottom'
        align='end'
        sideOffset={8}
        collisionPadding={12}
        loop
        onKeyDown={() => setKeyboard(true)}
      >
        <DropdownMenuLabel className='mf-preference-menu-heading'>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const option = options.find((item) => item.value === next)
            if (option) onValueChange(option.value)
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className='mf-preference-menu-item'
            >
              <span className='mf-preference-option-icon' aria-hidden='true'>
                {option.icon}
              </span>
              <span className='mf-preference-option-label'>{option.label}</span>
              <i
                className='ri-check-line mf-preference-option-check'
                aria-hidden='true'
                data-checked={option.value === value}
              />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  )
}
