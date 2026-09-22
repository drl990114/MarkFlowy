import { useRouter } from 'next/router'
import { useCallback, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { MenuItem, MenuProvider, MenuWrapper, useMenuStore } from 'zens'
import { useTheme } from '../hooks/useTheme'
import { applicationThemes } from '../utils/websiteTheme'
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

/** Shared Web appearance/language menu; zens owns positioning and focus management. */
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
  const menu = useMenuStore({ placement: 'bottom-end', focusLoop: true })
  const open = menu.useState('open')
  const [keyboard, setKeyboard] = useState(false)
  const id = useId()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  // The legacy zens styles calculate colors in JS, so they need concrete tokens.
  // The custom menu styles continue to use Web's prepaint CSS variables.
  const menuTheme = applicationThemes[resolvedTheme]
  const selectedLabel = options.find((option) => option.value === value)?.label
  const attachTrigger = useCallback(
    (element: HTMLButtonElement | null) => {
      menu.setDisclosureElement(element)
      menu.setAnchorElement(element)
    },
    [menu],
  )

  useEffect(() => {
    router.events.on('routeChangeStart', menu.hide)
    return () => router.events.off('routeChangeStart', menu.hide)
  }, [menu, router.events])

  return (
    <MenuProvider store={menu}>
      <NavButton
        ref={attachTrigger}
        type='button'
        className={['mf-preference-trigger', className].filter(Boolean).join(' ')}
        style={style}
        disabled={disabled}
        aria-label={label}
        title={selectedLabel ? `${label}: ${selectedLabel}` : label}
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={id}
        data-instant={keyboard}
        onFocus={() => {
          menu.setAutoFocusOnShow(false)
          menu.setActiveId(null)
        }}
        onClick={(event) => {
          setKeyboard(event.detail === 0)
          menu.setAutoFocusOnShow(true)
          menu.setInitialFocus(event.detail === 0 ? 'first' : 'container')
          menu.toggle()
        }}
        onKeyDown={(event) => {
          setKeyboard(true)
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault()
          menu.setAutoFocusOnShow(true)
          menu.setInitialFocus(event.key === 'ArrowUp' ? 'last' : 'first')
          menu.show()
        }}
      >
        <span className='mf-preference-trigger-icon' aria-hidden='true'>
          {icon}
        </span>
      </NavButton>
      <MenuWrapper
        id={id}
        className='mf-preference-menu'
        theme={menuTheme}
        aria-label={label}
        data-mf-portal=''
        data-instant={keyboard}
        portal
        modal={false}
        gutter={8}
        overflowPadding={12}
        unmountOnHide
        onKeyDown={() => setKeyboard(true)}
      >
        <div className='mf-preference-menu-heading' aria-hidden='true'>
          {label}
        </div>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            theme={menuTheme}
            className='mf-preference-menu-item'
            render={<button type='button' />}
            role='menuitemradio'
            aria-checked={option.value === value}
            onClick={() => onValueChange(option.value)}
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
          </MenuItem>
        ))}
      </MenuWrapper>
    </MenuProvider>
  )
}
