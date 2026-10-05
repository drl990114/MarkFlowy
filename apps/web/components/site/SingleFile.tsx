import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import Link from 'next/link'
import singleFileScreenshot from '../../public/screenshots/single-file.png'
import SiteArrow from './Arrow'
import Reveal from './Reveal'

const details = [
  ['open', 'ri-file-text-line'],
  ['focus', 'ri-focus-3-line'],
  ['grow', 'ri-folder-open-line'],
] as const

export default function SingleFile() {
  const { t } = useTranslation()

  return (
    <section className='mf-single-file' id='single-file' aria-labelledby='single-file-title'>
      <div className='mf-container mf-single-file-layout'>
        <Reveal className='mf-single-file-copy'>
          <p className='mf-eyebrow'>{t('site.singleFile.eyebrow')}</p>
          <h2 className='mf-section-title' id='single-file-title'>
            {t('site.singleFile.title')}
          </h2>
          <p className='mf-section-copy'>{t('site.singleFile.description')}</p>
          <ul className='mf-single-file-details'>
            {details.map(([key, icon]) => (
              <li key={key}>
                <i className={icon} aria-hidden='true' />
                <div>
                  <h3>{t(`site.singleFile.${key}.title`)}</h3>
                  <p>{t(`site.singleFile.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link className='mf-text-link' href='/docs/intro'>
            {t('site.singleFile.link')}
            <SiteArrow />
          </Link>
        </Reveal>
        <Reveal className='mf-single-file-product'>
          <figure>
            <div className='mf-preview-frame'>
              <Image
                className='mf-preview-screenshot'
                src={singleFileScreenshot}
                alt={t('site.singleFile.screenshotAlt')}
                sizes='(max-width: 639px) calc(100vw - 40px), (max-width: 939px) calc(100vw - 64px), (max-width: 1184px) calc((100vw - 112px) * 0.6), 643px'
              />
            </div>
            <figcaption className='mf-preview-caption'>{t('site.singleFile.note')}</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}
