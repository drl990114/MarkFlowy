import FeatureList from 'components/FeatureList'
import type { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import Nav from '../components/HomeNav'
import SeoHead from '../components/SeoHead'
import SiteArrow from '../components/site/Arrow'
import Contributors from '../components/site/Contributors'
import SiteFooter from '../components/site/Footer'
import HomeMotion from '../components/site/HomeMotion'
import PlatformMarquee from '../components/site/PlatformMarquee'
import Preview from '../components/site/Preview'
import ProjectStats from '../components/site/ProjectStats'
import Reveal from '../components/site/Reveal'
import Ribbon from '../components/site/Ribbon'
import Workflow from '../components/site/Workflow'
import { useSystemType } from '../hooks/useSystemType'
import { loadContributors, type Contributor } from '../utils/contributors'
import { loadProjectStats, type ProjectStats as ProjectStatsData } from '../utils/projectStats'
import { DEMO_URL, DOWNLOAD_URL } from '../utils/website'

export default function Index({
  contributors = [],
  projectStats,
}: {
  contributors?: Contributor[]
  projectStats: ProjectStatsData
}) {
  const { t } = useTranslation()
  const [folded, setFolded] = useState(true)
  const toggle = useCallback(() => setFolded((value) => !value), [])
  const system = useSystemType()
  const icon =
    system === 'macos'
      ? 'ri-apple-fill'
      : system === 'windows'
        ? 'ri-windows-fill'
        : system === 'linux'
          ? 'ri-ubuntu-fill'
          : 'ri-download-line'
  return (
    <>
      <SeoHead title={t('home.hero.metaTitle')} description={t('home.hero.description')} />
      <Nav showSideNav={false} isMobileNavFolded={folded} onMobileNavToggle={toggle} />
      <HomeMotion>
        <section className='mf-hero'>
          <Ribbon />
          <div className='mf-container mf-hero-content'>
            <p className='mf-eyebrow'>
              <span aria-hidden='true' />
              {t('site.hero.eyebrow')}
            </p>
            <h1>{t('site.hero.title')}</h1>
            <p className='mf-hero-lead'>{t('site.hero.lead')}</p>
            <p className='mf-hero-description'>{t('site.hero.description')}</p>
            <div className='mf-actions'>
              <Link className='mf-button' href={DOWNLOAD_URL}>
                <i className={icon} aria-hidden='true' />
                {t('home.hero.download')}
                <SiteArrow />
              </Link>
              <Link className='mf-button mf-button-secondary' href={DEMO_URL}>
                {t('site.hero.try')}
                <SiteArrow />
              </Link>
            </div>
          </div>
          <PlatformMarquee />
        </section>
        <section className='mf-preview-section' id='preview'>
          <div className='mf-container mf-preview-layout'>
            <Reveal className='mf-preview-copy'>
              <p className='mf-eyebrow'>{t('site.preview.eyebrow')}</p>
              <h2 className='mf-section-title'>{t('site.preview.title')}</h2>
              <p className='mf-section-copy'>{t('site.preview.description')}</p>
              <Link className='mf-text-link' href={DEMO_URL}>
                {t('site.hero.try')}
                <SiteArrow />
              </Link>
            </Reveal>
            <figure className='mf-preview-product'>
              <Preview />
              <figcaption className='mf-preview-caption'>{t('site.preview.note')}</figcaption>
            </figure>
          </div>
        </section>
        <FeatureList />
        <Workflow />
        <ProjectStats stats={projectStats} />
        <Contributors contributors={contributors} />
        <section className='mf-final-cta'>
          <div className='mf-container mf-final-cta-inner'>
            <div>
              <h2>{t('site.cta.title')}</h2>
              <p>{t('site.cta.body')}</p>
            </div>
            <div className='mf-actions'>
              <Link className='mf-button' href={DOWNLOAD_URL}>
                {t('home.hero.download')}
                <SiteArrow />
              </Link>
              <Link className='mf-button mf-button-secondary' href='/docs'>
                {t('site.cta.docs')}
                <SiteArrow />
              </Link>
            </div>
          </div>
        </section>
      </HomeMotion>
      <SiteFooter />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const [translations, contributors, projectStats] = await Promise.all([
    serverSideTranslations(locale || 'en', ['common']),
    loadContributors(),
    loadProjectStats(),
  ])
  return {
    props: {
      ...translations,
      contributors,
      projectStats,
    },
    revalidate: 3600,
  }
}
