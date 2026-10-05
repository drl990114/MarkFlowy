import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import homeScreenshot from '../../public/screenshots/home.png'
import Reveal from './Reveal'

export default function Preview() {
  const { t } = useTranslation()
  return (
    <Reveal className='mf-preview-entrance'>
      <div className='mf-preview-frame'>
        <Image
          className='mf-preview-screenshot'
          src={homeScreenshot}
          alt={t('site.preview.screenshotAlt')}
          sizes='(max-width: 639px) calc(100vw - 40px), (max-width: 1184px) calc(100vw - 64px), 1120px'
        />
      </div>
    </Reveal>
  )
}
