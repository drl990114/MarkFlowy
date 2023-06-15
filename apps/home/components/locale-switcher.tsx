import classNames from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/router'

export function LocaleSwitcher() {
  const {
    locales,
    asPath,
    locale: currentLocale,
  } = useRouter()

  return (
    <div className="flex">
      {locales?.map((locale) => (
        <Link
          href={asPath}
          key={locale}
          locale={locale}
          className={classNames(
            'flex items-center justify-center p-2 uppercase',
            locale === currentLocale ? 'text-black' : 'text-gray-500'
          )}
        >
          {locale}
        </Link>
      ))}
    </div>
  )
}
