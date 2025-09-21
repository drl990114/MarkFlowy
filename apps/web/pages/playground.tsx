import Nav from 'components/Nav'
import { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import dynamic from 'next/dynamic'
import Head from 'next/head'
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
  const [isMobileNavFolded, setIsMobileNavFolded] = useState(true)

  return (
    <>
      <Head>
        <title>Playground - Markflowy</title>
        <meta name='description' content='Experiment with the RME editor in Markflowy playground' />
      </Head>
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
