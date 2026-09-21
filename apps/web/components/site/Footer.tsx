import { useTranslation } from 'next-i18next'
import Link from 'next/link'
import { DEMO_URL, DOWNLOAD_URL, PRODUCT_URL } from '../../utils/website'
import { Logo } from '../Nav/Logo'

export default function SiteFooter() {
  const { t } = useTranslation()
  const groups = [
    {
      title: t('site.footer.product'),
      links: [
        [t('navigation.download'), DOWNLOAD_URL],
        [t('site.hero.try'), DEMO_URL],
        [t('navigation.releases'), '/releases'],
      ],
    },
    {
      title: t('site.footer.resources'),
      links: [
        [t('navigation.docs'), '/docs'],
        [t('navigation.webApp'), '/workspace'],
      ],
    },
    {
      title: t('site.footer.community'),
      links: [
        ['GitHub', PRODUCT_URL],
        [t('site.footer.contribute'), `${PRODUCT_URL}/blob/main/CONTRIBUTING.md`],
        [t('site.footer.feedback'), `${PRODUCT_URL}/issues`],
      ],
    },
  ]
  return (
    <footer className='mf-site-footer'>
      <div className='mf-container mf-footer-grid'>
        <div className='mf-footer-brand'>
          <Link href='/' className='mf-site-brand' aria-label='MarkFlowy'>
            <Logo size={28} />
            <span>MarkFlowy</span>
          </Link>
          <p>{t('site.footer.tagline')}</p>
          <span className='mf-footer-note'>macOS · Windows · Linux</span>
        </div>
        {groups.map(({ title, links }) => (
          <div key={title}>
            <h2>{title}</h2>
            <ul>
              {links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className='mf-container mf-footer-bottom'>
        <span>© 2023–{new Date().getFullYear()} MarkFlowy</span>
        <div>
          <Link href='/privacy' locale='en'>
            {t('site.footer.privacy')}
          </Link>
          <Link href={`${PRODUCT_URL}/blob/main/LICENSE`}>{t('site.footer.license')}</Link>
        </div>
        <span>{t('site.footer.made')}</span>
      </div>
    </footer>
  )
}
