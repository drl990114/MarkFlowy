import HighlightLink from 'components/HighLightLink'
import Markdown from 'markdown-to-jsx'
import type { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import styled from 'styled-components'
import Anchor from '../components/Anchor'
import DocsLayout, { type DocsLayoutProps } from '../components/DocsLayout'
import Link from '../components/Link'
import Loading from '../components/Loading'
import { getReleases } from '../utils/githubApi'
import rem from '../utils/rem'

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
      <p>
        {t('releases.description_before_link')}{' '}
        <HighlightLink href='https://github.com/drl990114/MarkFlowy/releases' target='_blank'>
          {t('releases.github_link')}
        </HighlightLink>{' '}
        {t('releases.description_after_link')}
      </p>

      {releases ? (
        releases.map((release) => (
          <section key={release.id}>
            <ReleaseAnchor
              id={release.name!}
              data-created-at={release.created_at.replace(/T.*?$/, '')}
            >
              {release.name}
            </ReleaseAnchor>
            <Link href={release.html_url} target='_blank'>
              {t('releases.see_details')}
            </Link>
            {release.body && <Markdown css='padding-left: 1em;'>{release.body}</Markdown>}
          </section>
        ))
      ) : (
        <Loading />
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

const ReleaseAnchor = styled(Anchor)`
  &::after {
    color: rosybrown;
    content: attr(data-created-at);
    display: block;
    font-size: 16px;
    margin-top: ${rem(-5)};
  }
`
