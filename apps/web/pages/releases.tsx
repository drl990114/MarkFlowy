import { ServerResponse } from 'http'
import Markdown from 'markdown-to-jsx'
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
  return (
    <DocsLayout
      useDocsSidebarMenu={false}
      pages={sidebarPages}
      title='Releases'
      description='Styled Components Releases'
    >
      <p>
        Updating styled components is usually as simple as <code>npm update styled-components</code>
        . Only major versions have the potential to introduce breaking changes (noted in the
        following release notes).
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

Releases.getInitialProps = async ({ res }: { res: ServerResponse }): Promise<ReleasesProps> => {
  try {
    const releases = await getReleases()
    return {
      releases,
      sidebarPages: releases.map((release) => ({
        href: release.tag_name!,
        pathname: '',
        sections: [],
        title: release.name!,
      })),
    }
  } catch (error) {
    if (res) {
      res.statusCode = 500
    }
    // 可以根据需要记录错误，比如console.error(error)
    return {
      releases: [],
      sidebarPages: [],
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
`;