import { useTranslation } from 'next-i18next'
import { useId } from 'react'
import { formatProjectCount } from '../../utils/formatProjectCount'
import type { ProjectStats as ProjectStatsData } from '../../utils/projectStats'
import { useSceneMotion } from './HomeMotion'
import Reveal from './Reveal'

// Two open fans converge at the centre. Static geometry also works without JS.
const strands = Array.from({ length: 38 }, (_, index) => {
  const spread = index / 37
  return {
    rising: `M -80 ${435 + spread * 65} C 250 ${545 - spread * 170}, 575 ${315 - spread * 125}, 780 ${260 - spread * 54} S 1220 ${20 + spread * 310}, 1520 ${55 + spread * 270}`,
    falling: `M -80 ${260 + spread * 90} C 200 ${70 + spread * 240}, 560 ${155 + spread * 45}, 780 ${205 + spread * 65} S 1240 ${430 - spread * 130}, 1520 ${285 + spread * 125}`,
    // Trigonometry can differ in the last bit between server and browser engines.
    opacity: (0.25 + Math.sin(spread * Math.PI) * 0.5).toFixed(3),
  }
})

export default function ProjectStats({ stats }: { stats: ProjectStatsData }) {
  const { t, i18n } = useTranslation()
  const { ref, running } = useSceneMotion()
  const gradientId = useId().replace(/:/g, '')
  const date = new Intl.DateTimeFormat(i18n.language || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(stats.checkedAt))
  const metrics = [
    { key: 'stars', value: stats.stars, href: 'https://github.com/drl990114/MarkFlowy/stargazers' },
    { key: 'forks', value: stats.forks, href: 'https://github.com/drl990114/MarkFlowy/forks' },
    {
      key: 'downloads',
      value: stats.downloads,
      href: 'https://github.com/drl990114/MarkFlowy/releases',
    },
  ]
  return (
    <section className='mf-project-stats' id='project-stats' aria-labelledby='mf-stats-title'>
      <div className='mf-container'>
        <Reveal className='mf-stats-heading'>
          <p className='mf-eyebrow'>{t('site.stats.eyebrow')}</p>
          <h2 className='mf-section-title' id='mf-stats-title'>
            {t('site.stats.title')}
          </h2>
          <p className='mf-section-copy'>{t('site.stats.body')}</p>
        </Reveal>
      </div>
      <div ref={ref} className='mf-stats-wave' data-running={running} aria-hidden='true'>
        <svg viewBox='0 0 1440 480' fill='none' focusable='false'>
          <defs>
            <linearGradient
              id={`${gradientId}-rise`}
              x1='0'
              y1='400'
              x2='1440'
              y2='0'
              gradientUnits='userSpaceOnUse'
            >
              <stop stopColor='var(--mf-site-cyan)' stopOpacity='0' />
              <stop offset='.3' stopColor='var(--mf-site-blue)' />
              <stop offset='.58' stopColor='var(--mf-site-accent)' />
              <stop offset='.85' stopColor='var(--mf-site-purple)' />
              <stop offset='1' stopColor='var(--mf-site-purple)' stopOpacity='0' />
            </linearGradient>
            <linearGradient
              id={`${gradientId}-fall`}
              x1='0'
              y1='0'
              x2='1440'
              y2='440'
              gradientUnits='userSpaceOnUse'
            >
              <stop stopColor='var(--mf-site-blue)' stopOpacity='0' />
              <stop offset='.2' stopColor='var(--mf-site-accent)' />
              <stop offset='.52' stopColor='var(--mf-site-purple)' />
              <stop offset='.8' stopColor='var(--mf-site-blue)' />
              <stop offset='1' stopColor='var(--mf-site-cyan)' stopOpacity='0' />
            </linearGradient>
          </defs>
          <g
            className='mf-stats-strands mf-stats-strands-rising'
            stroke={`url(#${gradientId}-rise)`}
            strokeWidth='1.25'
          >
            {strands.map((strand) => (
              <path key={strand.rising} d={strand.rising} opacity={strand.opacity} />
            ))}
          </g>
          <g
            className='mf-stats-strands mf-stats-strands-falling'
            stroke={`url(#${gradientId}-fall)`}
            strokeWidth='1.25'
          >
            {strands.map((strand) => (
              <path key={strand.falling} d={strand.falling} opacity={strand.opacity} />
            ))}
          </g>
        </svg>
      </div>
      <div className='mf-container mf-stats-details'>
        <dl className='mf-stats-grid'>
          {metrics.map((metric, index) => (
            <Reveal className='mf-stat' key={metric.key} delay={index * 80}>
              <dt>
                <a href={metric.href}>
                  {t(`site.stats.${metric.key}`)}
                  <i className='ri-arrow-right-up-line' aria-hidden='true' />
                </a>
              </dt>
              <dd>{formatProjectCount(metric.value, i18n.language || 'en')}</dd>
            </Reveal>
          ))}
        </dl>
        <p className='mf-stats-source'>
          {t('site.stats.source')} · {t('site.stats.updated')}{' '}
          <time dateTime={stats.checkedAt}>{date}</time>
          <span>{t('site.stats.downloadNote')}</span>
        </p>
      </div>
    </section>
  )
}
