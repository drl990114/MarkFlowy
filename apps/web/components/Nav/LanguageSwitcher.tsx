import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import React from 'react'
import styled from 'styled-components'
import rem from '../../utils/rem'

interface LanguageSwitcherProps {
  className?: string
  style?: React.CSSProperties
}

const TransIcon = () => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      style={{ width: '20px' }}
      viewBox='0 0 24 24'
      fill='currentColor'
    >
      <path d='M18.5 10L22.9 21H20.745L19.544 18H15.454L14.255 21H12.101L16.5 10H18.5ZM10 2V4H16V6L14.0322 6.0006C13.2425 8.36616 11.9988 10.5057 10.4115 12.301C11.1344 12.9457 11.917 13.5176 12.7475 14.0079L11.9969 15.8855C10.9237 15.2781 9.91944 14.5524 8.99961 13.7249C7.21403 15.332 5.10914 16.5553 2.79891 17.2734L2.26257 15.3442C4.2385 14.7203 6.04543 13.6737 7.59042 12.3021C6.46277 11.0281 5.50873 9.57985 4.76742 8.00028L7.00684 8.00037C7.57018 9.03885 8.23979 10.0033 8.99967 10.877C10.2283 9.46508 11.2205 7.81616 11.9095 6.00101L2 6V4H8V2H10ZM17.5 12.8852L16.253 16H18.745L17.5 12.8852Z'></path>
    </svg>
  )
}

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
]

export default function LanguageSwitcher({ className, style }: LanguageSwitcherProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const currentLocale = router.locale || 'en'

  const handleLanguageChange = (locale: string) => {
    const { pathname, asPath, query } = router
    router.push({ pathname, query }, asPath, { locale })
  }

  const currentLanguage = languages.find((lang) => lang.code === currentLocale) || languages[0]

  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <Container ref={containerRef} className={className} style={style}>
      <TriggerButton
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
      >
        <TransIcon />
      </TriggerButton>

      {isOpen && (
        <Menu role='listbox'>
          {languages.map((language) => (
            <MenuItem
              role='option'
              aria-selected={language.code === currentLocale}
              key={language.code}
              onClick={() => {
                setIsOpen(false)
                handleLanguageChange(language.code)
              }}
            >
              <span style={{ marginRight: 8 }}>{language.flag}</span>
              <span>{language.name}</span>
            </MenuItem>
          ))}
        </Menu>
      )}
    </Container>
  )
}

const Container = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`

const TriggerButton = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: white;
  font-size: ${rem(14)};
  padding: ${rem(6)} ${rem(8)};
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.4);
  }

  &:focus {
    border-color: rgba(255, 255, 255, 0.6);
  }
`

const Menu = styled.ul`
  position: absolute;
  top: calc(100% + ${rem(6)});
  right: 0;
  min-width: ${rem(160)};
  background: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${rem(8)};
  padding: ${rem(6)} 0;
  margin: 0;
  list-style: none;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  z-index: 1000;
`

const MenuItem = styled.li`
  display: flex;
  align-items: center;
  padding: ${rem(8)} ${rem(12)};
  cursor: pointer;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
`
