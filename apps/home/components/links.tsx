import classNames from 'classnames'
import Link from 'next/link'

export function Links({ links }: LinksProps) {
  if (!links.length) return null

  return (
    <div className="grid gap-4 mt-6 sm:grid-cols-2">
      {links.map((link, index) => (
        <Link
          href={link.url}
          key={index}
          passHref
          className={classNames(
            'px-6 py-3 text-lg transition-colors rounded-md ',
            index === 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 hover:bg-gray-200 text-black'
          )}
        >
          {link.title}
        </Link>
      ))}
    </div>
  )
}
