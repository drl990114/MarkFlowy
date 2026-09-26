import { useTranslation } from 'next-i18next'
import Image from 'next/image'
import Reveal from './Reveal'

export default function Preview() {
  const { t } = useTranslation()
  return (
    <Reveal className='mf-preview-entrance'>
      <div className='mf-preview-frame'>
        <Image
          className='mf-preview-screenshot'
          src='/screenshots/sourcecode.png'
          alt={t('site.preview.screenshotAlt')}
          width={2454}
          height={1514}
          sizes='(max-width: 639px) calc(100vw - 40px), (max-width: 939px) calc(100vw - 64px), (max-width: 1184px) calc((100vw - 64px) * 0.667 - 11px), 736px'
        />
      </div>
    </Reveal>
  )
}
