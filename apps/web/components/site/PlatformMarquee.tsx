import { useTranslation } from 'next-i18next'
import { useSceneMotion } from './HomeMotion'

const platforms = [
  ['ri-apple-fill', 'macOS'],
  ['ri-windows-fill', 'Windows'],
  ['ri-ubuntu-fill', 'Linux'],
  ['ri-markdown-line', 'Markdown'],
  ['ri-github-fill', 'Open source'],
]

export default function PlatformMarquee() {
  const { t } = useTranslation()
  const { ref, running } = useSceneMotion()
  return (
    <div ref={ref} className='mf-platform-band' data-running={running}>
      <div className='mf-container mf-platform-marquee' aria-label={t('site.hero.platforms')}>
        <div className='mf-platform-track'>
          {[0, 1].map((copy) => (
            <div className='mf-platform-group' key={copy} aria-hidden={copy === 1 || undefined}>
              {platforms.map(([icon, label]) => (
                <span key={label}>
                  <i className={icon} aria-hidden='true' />
                  {label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
