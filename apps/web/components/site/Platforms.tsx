import { useTranslation } from 'next-i18next'

const platforms = [
  ['ri-apple-fill', 'macOS'],
  ['ri-windows-fill', 'Windows'],
  ['ri-ubuntu-fill', 'Linux'],
  ['ri-markdown-line', 'Markdown'],
  ['ri-github-fill', 'Open source'],
]

export default function Platforms() {
  const { t } = useTranslation()
  return (
    <div className='mf-platform-band'>
      <ul className='mf-container mf-platform-list' aria-label={t('site.hero.platforms')}>
        {platforms.map(([icon, label]) => (
          <li key={label}>
            <i className={icon} aria-hidden='true' />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
