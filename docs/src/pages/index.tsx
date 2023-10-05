import React from 'react'
import Layout from '@theme/Layout'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'

import Banner from './banner'
import PoweredByTheWeb from './about'
import Support from './support'

export default function Home() {
  const { siteConfig } = useDocusaurusContext()
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description='MarkFlowy.'
    >
      <div className='container'>
        <Banner />
        <PoweredByTheWeb />
        <Support />
      </div>
    </Layout>
  )
}
