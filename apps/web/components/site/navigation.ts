import { DEMO_URL, DOWNLOAD_URL, PRODUCT_URL } from '../../utils/website'

export type SiteMenuLink = { title: string; description?: string; href: string }
export type SiteMenu = {
  id: string
  title: string
  sections: { title: string; links: SiteMenuLink[] }[]
}

/** Shared by the desktop mega menu and the mobile drill-down. */
export const siteMenus: SiteMenu[] = [
  {
    id: 'product',
    title: 'site.footer.product',
    sections: [
      {
        title: 'site.nav.writing',
        links: [
          {
            title: 'site.nav.editor',
            description: 'site.nav.editorDescription',
            href: '/docs/intro',
          },
          { title: 'site.hero.try', description: 'site.nav.demoDescription', href: DEMO_URL },
        ],
      },
      {
        title: 'site.nav.workspace',
        links: [
          {
            title: 'site.nav.files',
            description: 'site.nav.filesDescription',
            href: '/docs/Performance/large-markdown-files',
          },
          {
            title: 'site.nav.assistant',
            description: 'site.nav.assistantDescription',
            href: '/docs/Extension/UseCopilotWithOllama',
          },
          {
            title: 'site.nav.themes',
            description: 'site.nav.themesDescription',
            href: '/docs/Extension/CustomTheme',
          },
        ],
      },
      {
        title: 'site.nav.start',
        links: [
          {
            title: 'navigation.download',
            description: 'site.nav.downloadDescription',
            href: DOWNLOAD_URL,
          },
          {
            title: 'navigation.webApp',
            description: 'site.nav.webDescription',
            href: '/workspace',
          },
          {
            title: 'site.nav.features',
            description: 'site.nav.featuresDescription',
            href: '/#features',
          },
        ],
      },
    ],
  },
  {
    id: 'resources',
    title: 'site.footer.resources',
    sections: [
      {
        title: 'navigation.docs',
        links: [
          { title: 'site.nav.quickstart', href: '/docs/intro' },
          { title: 'site.nav.files', href: '/docs/Performance/large-markdown-files' },
          { title: 'site.nav.assistant', href: '/docs/Extension/UseCopilotWithOllama' },
          { title: 'site.nav.themes', href: '/docs/Extension/CustomTheme' },
        ],
      },
      {
        title: 'site.nav.explore',
        links: [
          { title: 'navigation.releases', href: '/releases' },
          { title: 'site.footer.privacy', href: '/privacy' },
        ],
      },
      {
        title: 'site.nav.support',
        links: [
          { title: 'site.footer.feedback', href: `${PRODUCT_URL}/issues` },
          { title: 'site.footer.contribute', href: '/docs/Community/CONTRIBUTING' },
          { title: 'site.footer.license', href: '/docs/Community/License' },
        ],
      },
    ],
  },
  {
    id: 'community',
    title: 'site.nav.openSource',
    sections: [
      {
        title: 'site.nav.buildTogether',
        links: [
          { title: 'GitHub', description: 'site.nav.githubDescription', href: PRODUCT_URL },
          {
            title: 'site.footer.contribute',
            description: 'site.nav.contributeDescription',
            href: '/docs/Community/CONTRIBUTING',
          },
        ],
      },
      {
        title: 'site.footer.community',
        links: [
          {
            title: 'site.footer.feedback',
            description: 'site.nav.feedbackDescription',
            href: `${PRODUCT_URL}/issues`,
          },
          {
            title: 'site.nav.contributors',
            description: 'site.nav.contributorsDescription',
            href: `${PRODUCT_URL}/graphs/contributors`,
          },
        ],
      },
    ],
  },
]
