import Nav from 'components/Nav'
import type { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useTranslation } from 'next-i18next'
import dynamic from 'next/dynamic'
import SeoHead from '../components/SeoHead'
import { useState } from 'react'
import styled from 'styled-components'

// 动态导入RME编辑器，禁用SSR
const PlaygroundContent = dynamic(() => import('../components/PlaygroundCSRContent'), {
  ssr: false,
  loading: () => <LoadingContainer>Loading Editor...</LoadingContainer>,
})

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 16px;
  color: ${(props) => props.theme.labelFontColor};
`

const Playground = () => {
  const { t } = useTranslation()
  const [isMobileNavFolded, setIsMobileNavFolded] = useState(true)

  return (
    <>
      <SeoHead title={`${t('playground.title')} | MarkFlowy`} description={t('playground.description')} />
      <Nav
        showSideNav={false}
        isMobileNavFolded={isMobileNavFolded}
        onMobileNavToggle={() => setIsMobileNavFolded((x) => !x)}
      />

      <PlaygroundContent />
    </>
  )
}

export default Playground

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'en', ['common'])),
    },
  }
}
