import React from 'react'
import Translate from '@docusaurus/Translate'
import Link from '@docusaurus/Link'
import { Typewriter } from '../util/typewriter'

const Banner = () => {
  return (
    <div className='padding-top--l padding-bottom--xl banner'>
      <div className='welcome--section'>
        <h1 className='banner--title margin-bottom--md'>
          {' '}
          Edit <Typewriter strings={['Flowy.', 'Smart.', 'Efficient.']} />
        </h1>
        <h1 className='banner--subtitle margin-top--md margin-bottom--lg'>
          <Translate id='welcome.keyword'> MarkFlowy.</Translate>
        </h1>
        <div className='margin-top--lg btn-list'>
          <a
            className='btn margin--sm download--btn'
            href='https://github.com/drl990114/MarkFlowy/releases'
            target='_blank' rel="noreferrer"
          >
            <Translate id='welcome.download'> Download now</Translate>
          </a>
          <Link to='/docs/intro' className='margin--sm explore--docs--link btn'>
            <Translate id='welcome.xploreTheDocs'>Read documentation</Translate>
          </Link>
        </div>
        <h2 className='banner--description margin-top--xl margin-bottom--lg'>
          <Translate id='welcome.description'>
            Free and Open Source Software. Runs everywhere.
          </Translate>
        </h2>
      </div>
    </div>
  )
}
export default Banner
