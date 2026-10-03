import HighlightLink from 'components/HighLightLink'
import Markdown from 'markdown-to-jsx'
import type { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import styled from 'styled-components'
import DocsLayout, { type DocsLayoutProps } from '../components/DocsLayout'
import Link from '../components/Link'
import { DocsArticle } from '../components/DocsContent'
import { getReleases } from '../utils/githubApi'

export interface ReleasesProps {
  releases: Awaited<ReturnType<typeof getReleases>>
  sidebarPages: DocsLayoutProps['pages']
}

export default function Releases({ releases, sidebarPages }: ReleasesProps) {
  const { t } = useTranslation()

  return (
    <DocsLayout
      useDocsSidebarMenu={false}
      pages={sidebarPages}
      title={t('releases.title')}
      description={t('releases.meta_description')}
    >
      <p className='mf-eyebrow'>{t('site.releases.eyebrow')}</p>
      <p>
        {t('releases.description_before_link')}{' '}
        <HighlightLink href='https://github.com/drl990114/MarkFlowy/releases' target='_blank'>
          {t('releases.github_link')}
        </HighlightLink>{' '}
        {t('releases.description_after_link')}
      </p>

      {releases.length > 0 ? (
        releases.map((release, index) => (
          <Release key={release.id} id={release.tag_name}>
            <ReleaseMeta>
              <time dateTime={release.published_at || release.created_at}>
                {(release.published_at || release.created_at).slice(0, 10)}
              </time>
              {index === 0 && <span>{t('site.releases.latest')}</span>}
            </ReleaseMeta>
            <ReleaseTitle>
              {release.name !== release.tag_name && <span id={release.name || undefined} />}
              <a href={`#${release.tag_name}`}>{release.name || release.tag_name}</a>
            </ReleaseTitle>
            <Link href={release.html_url} target='_blank'>
              {t('releases.see_details')} ↗
            </Link>
            {release.body && (
              <DocsArticle as='div'>
                <Markdown>{release.body}</Markdown>
              </DocsArticle>
            )}
          </Release>
        ))
      ) : (
        <p>{t('site.releases.empty')}</p>
      )}
    </DocsLayout>
  )
}

export const getStaticProps: GetStaticProps<ReleasesProps> = async ({ locale }) => {
  try {
    const releases = await getReleases()

    return {
      props: {
        releases,
        sidebarPages: releases.map((release) => ({
          href: release.tag_name!,
          pathname: '',
          sections: [],
          title: release.name!,
        })),
        ...(await serverSideTranslations(locale || 'en', ['common'])),
      },
    }
  } catch (error) {
    console.error('Error fetching releases:', error)
    return {
      props: {
        releases: [],
        sidebarPages: [],
        ...(await serverSideTranslations(locale || 'en', ['common'])),
      },
    }
  }
}

const Release = styled.section`
  position: relative;
  margin: 3rem 0;
  padding: 0 0 0 1.75rem;
  border-left: 1px solid var(--line);
  &::before {
    content: '';
    position: absolute;
    top: 0.5rem;
    left: -4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--seal);
  }
`

const ReleaseMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  color: var(--ink-mute);
  font-size: 12px;
  span {
    color: var(--seal);
    background: var(--paper-warm);
    border: 1px solid var(--line-soft);
    border-radius: 4px;
    padding: 2px 8px;
  }
`

const ReleaseTitle = styled.h2`
  margin: 0 0 10px;
  color: var(--ink);
  font-size: 27px;
  font-weight: 550;
  scroll-margin-top: 96px;
`
