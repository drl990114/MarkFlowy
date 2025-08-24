import HighlightLink from 'components/HighLightLink'
import Markdown from 'markdown-to-jsx'
import { GetStaticProps } from 'next'
import { i18n } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import styled from 'styled-components'
import Anchor from '../components/Anchor'
import DocsLayout, { DocsLayoutProps } from '../components/DocsLayout'
import Link from '../components/Link'
import Loading from '../components/Loading'
import { getReleases } from '../utils/githubApi'
import rem from '../utils/rem'

export interface ReleasesProps {
  releases: Awaited<ReturnType<typeof getReleases>>
  sidebarPages: DocsLayoutProps['pages']
}

export default function Releases({ releases, sidebarPages }: ReleasesProps) {
  const localesDescMap = {
    en: (
      <p>
        Here are the latest releases of Markflowy. Click on each version to see the detailed changes
        and updates. You can download it from the{' '}
        <HighlightLink
          href='https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA'
          target='_blank'
        >
          {' '}UpgradeLink download page{' '}
        </HighlightLink>
        or the
        <HighlightLink href='https://github.com/drl990114/MarkFlowy/releases' target='_blank'>
          {' '}GitHub Release{' '}
        </HighlightLink>
        .
      </p>
    ),
    zh: (
      <p>
        以下是 Markflowy 的最新版本发布。点击每个版本可以查看详细的变更和更新内容。你可以从
        <HighlightLink
          href='https://download.upgrade.toolsetlink.com/download?appKey=xpn68m4j5qU0Y1rfDYFHaA'
          target='_blank'
        >
          {' '}UpgradeLink 下载页面{' '}
        </HighlightLink>
        或者{' '}
        <HighlightLink href='https://github.com/drl990114/MarkFlowy/releases' target='_blank'>
          {' '}GitHub Release{' '}
        </HighlightLink>
        下载。
      </p>
    ),
  }

  const currentLanguage = i18n?.language || 'en'
  const currentLocaleDesc =
    localesDescMap[currentLanguage as keyof typeof localesDescMap] || localesDescMap.en

  return (
    <DocsLayout
      useDocsSidebarMenu={false}
      pages={sidebarPages}
      title='Releases'
      description='Styled Components Releases'
    >
      {currentLocaleDesc}

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
              see details
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
