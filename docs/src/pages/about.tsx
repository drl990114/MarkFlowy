import Slideshow from '../util/slideshow'
import Translate from '@docusaurus/Translate'
import React from 'react'
import { Check } from '../util/icon'

const PoweredByTheWeb = () => {
  return (
    <div className='padding-top--xl powered-by-web padding-bottom--l'>
      <h1>
        <Translate id='about.title'>Cross-platform Markdown Editor.</Translate>
      </h1>

      <span className='powered-by-web--desc'>
        <Translate id='about.builtUsing'>Being built using the</Translate>{' '}
        <a href='https://tauri.studio' target='_blank' rel='noreferrer'>
          Tauri Framework
        </a>
        <Translate id='about.written'>, and written using</Translate>{' '}
        <a href='https://www.typescriptlang.org/' target='_blank' rel='noreferrer'>
          TypeScript
        </a>{' '}
        <Translate id='about.typescriptUsage'>for the frontend and</Translate>{' '}
        <a href='https://www.rust-lang.org/' target='_blank' rel='noreferrer'>
          Rust
        </a>{' '}
        <Translate id='about.rustUsage'>for the backend</Translate>,{' '}
        <Translate id='about.promise'>Xplorer promises you an unprecedented experience.</Translate>
      </span>
      <div className='row margin-top--lg'>
        <div className='col col--6 padding--lg'>
          <Slideshow />
        </div>
        <div className='col col--6 padding--md features-container'>
          <div className='feature margin-bottom--md'>
            <h2>
              <Translate id='feature.multipleTabs'>Super lightweight</Translate>
            </h2>
            <p>
              <Translate id='feature.multipleTabsDescription'>
                MarkFlowy is based on Tauri, which ensures ultra-lightweight and fast performance
                experience.
              </Translate>
            </p>
          </div>
          <div className='feature margin-bottom--md'>
            <h2>
              <Translate id='feature.filePreview'>Built-in ChatGpt</Translate>
            </h2>
            <p>
              <Translate id='feature.filePreviewDescriptionPart1'>
                Currently supports one-click export of conversations, making chatgpt your smart
                assistant.
              </Translate>
            </p>
          </div>
          <div className='feature margin-bottom--md'>
            <h2>
              <Translate id='feature.filePreviewTitle2'>High availability</Translate>
            </h2>
            <p>
              <Translate id='feature.filePreviewDescriptionPart2'>
                MarkFlowy uses the remirror editor, which not only provides high scalability, but
                also has a great editing experience. And, MarkFlowy supports multiple editing modes,
                such as `source code`, `wysiwyg`.
              </Translate>
            </p>
          </div>
          <div className='feature margin-bottom--md'>
            <h2>
              <Translate id='feature.filePreviewTitle3'>Custom Theme</Translate>
            </h2>
            <p>
              <Translate id='feature.filePreviewDescriptionPart3'>
                MarkFlowy supports custom themes, and you can also share your themes with others.
              </Translate>
            </p>
          </div>
        </div>
      </div>
      {/* <div className='row padding-horiz--lg'>
        <div className='col feature padding--md'>
          <h2>
            <Translate id='feature.designTitle'>Designed out of the box</Translate>
          </h2>
          <p>
            <Translate id='feature.designDescription'>
              Say goodbye to the old design by traditional app and say hello to this simple yet
              powerful design.
            </Translate>
          </p>
        </div>
        <div className='col feature padding--md'>
          <h2>
            <Translate id='feature.customizableTitle'>Customizable</Translate>
          </h2>
          <p>
            <Translate id='feature.customizableDescriptionPart1'>
              You can customize the look and feel of Xplorer by using different themes or
            </Translate>{' '}
            <Link to='/docs/Extensions/create/'>
              <Translate id='feature.customizableDescriptionPart2'>build your own theme</Translate>
            </Link>
            .
          </p>
        </div>
      </div> */}
    </div>
  )
}

export default PoweredByTheWeb
