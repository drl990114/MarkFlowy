import type { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import nextI18NextConfig from '../next-i18next.config.js'
import { Paragraph } from '@/components/paragraph'
import { Meta } from '@/components/meta'
import { Layout } from '@/components/layout'

export default function Home() {
  const { t } = useTranslation('common')

  return (
    <Layout
      menus={{
        main: [
          {
            id: 'Download',
            url: 'https://github.com/linebyline-group/linebyline/releases',
            type: 'link',
            title: 'Download',
          },
          {
            id: 'Github',
            type: 'link',
            title: 'Github',
            url: 'https://github.com/linebyline-group/linebyline',
          },
        ],
        footer: [
          {
            id: 'Github',
            url: 'https://github.com/linebyline-group/linebyline',
            type: 'link',
            title: 'Github',
          },
        ],
      }}
    >
      <Meta title="linebyline" />
      <Paragraph
        paragraph={{
          type: 'hero',
          field_heading: 'LineByLine',
          field_text: t('desc'),
        }}
      />
      <Paragraph
        paragraph={{
          type: 'cards',
          field_heading: t('features.title'),
          field_items: [
            {
              field_heading: t('features.feature1.title'),
              field_text: t('features.feature1.desc'),
              id: 'feature1',
            },
            {
              field_heading: t('features.feature2.title'),
              field_text: t('features.feature2.desc'),
              id: 'feature2',
            },
            {
              field_heading: t('features.feature3.title'),
              field_text: t('features.feature3.desc'),
              id: 'feature3',
            },
          ],
          field_text: t('features.desc'),
        }}
      />
      <Paragraph
        paragraph={{
          type: 'feature',
          field_heading: t('summary.title'),
          field_text: t('summary.desc'),
          field_background_color: 'muted',
          field_link: {
            id: 'download',
            url: 'https://github.com/linebyline-group/linebyline/releases',
            title: t('download'),
          },
          field_media: {
            field_media_image: {
              url: 'https://raw.githubusercontent.com/linebyline-group/linebyline/main/public/logo.svg',
              alt: 'logo',
              width: 200
            },
          },
        }}
      />
    </Layout>
  )
}

export const getStaticProps: GetStaticProps<{}> = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(
      locale ?? 'en',
      ['common'],
      nextI18NextConfig,
    )),
  },
})
