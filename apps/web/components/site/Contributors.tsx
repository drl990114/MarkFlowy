import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import Link from 'next/link'
import type { Contributor } from '../../utils/contributors'
import { PRODUCT_URL } from '../../utils/website'
import { MotionControl, useSceneMotion } from './HomeMotion'
import Reveal from './Reveal'

export default function Contributors({ contributors }: { contributors: Contributor[] }) {
  const { t } = useTranslation()
  const { ref, inView, running } = useSceneMotion()
  const rowCount = Math.min(3, contributors.length)
  const rows = Array.from({ length: rowCount }, (_, index) =>
    contributors.filter((_person, personIndex) => personIndex % rowCount === index),
  )
  return (
    <section className='mf-community' id='community'>
      <div className='mf-container' data-running={running}>
        <div className='mf-community-inner'>
          <Reveal className='mf-community-copy'>
            <p className='mf-eyebrow'>{t('site.community.eyebrow')}</p>
            <h2 className='mf-section-title'>{t('site.community.title')}</h2>
            <p className='mf-section-copy'>{t('site.community.body')}</p>
            <Link className='mf-text-link' href={`${PRODUCT_URL}/graphs/contributors`}>
              {t('home.contributors.viewAll')}
              <i className='ri-arrow-right-line' aria-hidden='true' />
            </Link>
            <div className='mf-community-controls'>
              <span>
                <i className='ri-github-fill' aria-hidden='true' /> {t('site.community.thanks')}
              </span>
              <MotionControl />
            </div>
          </Reveal>
          <div
            ref={ref}
            className='mf-contributor-wall'
            aria-label={t('site.nav.contributors')}
            onBlurCapture={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                event.currentTarget.contains(event.relatedTarget)
              )
                return
              // Keyboard navigation may scroll a lane; restore its seamless loop afterward.
              event.currentTarget.querySelectorAll('.mf-contributor-lane').forEach((lane) => {
                lane.scrollLeft = 0
              })
            }}
          >
            <div className='mf-community-glow' aria-hidden='true' />
            {rows.map((people) => (
              <div className='mf-contributor-lane' key={people[0].id}>
                <div className='mf-contributor-track'>
                  {[0, 1].map((copy) => (
                    <div
                      className='mf-contributor-group'
                      key={copy}
                      aria-hidden={copy === 1 || undefined}
                    >
                      {people.map((person) => (
                        <a
                          className='mf-contributor-card'
                          key={person.id}
                          href={person.html_url}
                          tabIndex={copy ? -1 : undefined}
                        >
                          <Image
                            unoptimized
                            src={person.avatar_url}
                            alt=''
                            width={44}
                            height={44}
                            loading={inView ? 'eager' : 'lazy'}
                          />
                          <span>
                            {person.login}
                            <small>GitHub</small>
                          </span>
                          <i className='ri-arrow-right-up-line' aria-hidden='true' />
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
