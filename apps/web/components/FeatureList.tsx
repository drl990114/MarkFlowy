import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import Link from 'next/link'
import SiteArrow from './site/Arrow'
import Reveal from './site/Reveal'
import { MotionScene } from './site/HomeMotion'

export default function FeatureList() {
  const { t } = useTranslation()
  return (
    <section className='mf-features' id='features'>
      <div className='mf-container'>
        <Reveal className='mf-section-heading'>
          <div>
            <p className='mf-eyebrow'>{t('site.features.eyebrow')}</p>
            <h2 className='mf-section-title'>{t('site.features.title')}</h2>
          </div>
          <p className='mf-section-copy'>{t('site.features.description')}</p>
        </Reveal>
        <div className='mf-feature-grid'>
          <Reveal className='mf-feature-card mf-feature-write'>
            <div className='mf-feature-card-copy'>
              <span className='mf-feature-index' aria-hidden='true'>
                01 / 04
              </span>
              <i className='ri-quill-pen-line mf-feature-icon' aria-hidden='true' />
              <h3>{t('site.features.write.title')}</h3>
              <p>{t('site.features.write.body')}</p>
              <Link className='mf-text-link' href='/docs/intro'>
                {t('site.features.write.link')}
                <SiteArrow />
              </Link>
            </div>
            <div className='mf-feature-visual'>
              <Image
                src='/screenshots/sourcecode.png'
                alt={t('site.features.write.alt')}
                width={2454}
                height={1514}
                sizes='(max-width: 639px) calc(100vw - 64px), (max-width: 650px) calc(100vw - 88px), (max-width: 1000px) calc(50vw - 80px), (max-width: 1184px) 58vw, 620px'
              />
            </div>
          </Reveal>
          <Reveal className='mf-feature-card mf-feature-card-dark' delay={80}>
            <div className='mf-feature-card-copy'>
              <span className='mf-feature-index' aria-hidden='true'>
                02 / 04
              </span>
              <i className='ri-folder-open-line mf-feature-icon' aria-hidden='true' />
              <h3>{t('site.features.local.title')}</h3>
              <p>{t('site.features.local.body')}</p>
              <Link className='mf-text-link' href='/docs/Performance/large-markdown-files'>
                {t('home.guides.performanceLink')}
                <SiteArrow />
              </Link>
            </div>
            <MotionScene className='mf-feature-visual mf-file-stack'>
              {[
                ['ri-markdown-line', 'ideas.md'],
                ['ri-file-code-line', 'config.json'],
                ['ri-file-text-line', 'notes.txt'],
              ].map(([icon, name]) => (
                <div className='mf-file-tile' key={name} aria-hidden='true'>
                  <i className={icon} />
                  <span>{name}</span>
                </div>
              ))}
            </MotionScene>
          </Reveal>
          <Reveal className='mf-feature-card mf-feature-ai'>
            <div className='mf-feature-card-copy'>
              <span className='mf-feature-index' aria-hidden='true'>
                03 / 04
              </span>
              <i className='ri-sparkling-line mf-feature-icon' aria-hidden='true' />
              <h3>{t('site.features.ai.title')}</h3>
              <p>{t('site.features.ai.body')}</p>
              <Link className='mf-text-link' href='/docs/Extension/UseCopilotWithOllama'>
                {t('home.guides.ollamaLink')}
                <SiteArrow />
              </Link>
            </div>
            <div className='mf-feature-visual mf-feature-visual-pink'>
              <Image
                src='/screenshots/ai.png'
                alt={t('site.features.ai.alt')}
                width={2454}
                height={1514}
                sizes='(max-width: 639px) calc(100vw - 64px), (max-width: 650px) calc(100vw - 88px), (max-width: 1000px) calc(50vw - 80px), (max-width: 1184px) 42vw, 440px'
              />
            </div>
          </Reveal>
          <Reveal className='mf-feature-card mf-feature-personal' delay={80}>
            <div className='mf-feature-card-copy'>
              <span className='mf-feature-index' aria-hidden='true'>
                04 / 04
              </span>
              <i className='ri-command-line mf-feature-icon' aria-hidden='true' />
              <h3>{t('site.features.personal.title')}</h3>
              <p>{t('site.features.personal.body')}</p>
              <Link className='mf-text-link' href='/docs/Extension/CustomTheme'>
                {t('site.features.personal.link')}
                <SiteArrow />
              </Link>
            </div>
            <MotionScene className='mf-feature-visual mf-shortcut-visual'>
              <div className='mf-shortcut-panel'>
                {['write', 'focus', 'command'].map((key, i) => (
                  <div className='mf-shortcut-row' key={key}>
                    <span className='mf-shortcut-highlight' aria-hidden='true' />
                    <span>{t(`site.features.shortcuts.${key}`)}</span>
                    <kbd>{['⌘ B', '⌘ ⇧ F', '⌘ ⇧ P'][i]}</kbd>
                  </div>
                ))}
              </div>
            </MotionScene>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
