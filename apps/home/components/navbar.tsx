import classNames from 'classnames'
import Link from 'next/link'
import { LocaleSwitcher } from './locale-switcher'

interface NavbarProps {
  links: ILink[]
}

export function Navbar({ links, ...props }: NavbarProps) {
  return (
    <header
      className="w-full top-0 z-50 flex-shrink-0 py-4 bg-white fixed h-20"
      {...props}
    >
      <div className="container flex flex-col items-start justify-between px-6 mx-auto md:flex-row md:items-center">
        <Link href="/" title="LineByLine">
          LineByLine
        </Link>
        {links ? <Menu items={links} /> : null}
        <div className="absolute flex justify-end md:static top-2 right-4">
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  )
}

function Menu({ items }: { items: ILink[] }) {
  return (
    <ul
      className="grid grid-flow-col gap-4 mx-auto mt-6 md:mt-0 auto-cols-auto md:auto-rows-auto md:gap-8 lg:gap-12"
      data-cy="navbar-menu"
    >
      {items.map(item => (
        <MenuLink link={item} key={item.id} />
      ))}
    </ul>
  )
}

function MenuLink({ link }: { link: ILink }) {
  const cls = classNames(
    'py-4 hover:underline text-sm md:text-base cussor-pointer',
  )
  return (
    <li>
      {link.type === 'contorl'
        ? (
        <a className={cls}>{link.title}</a>
          )
        : (
        <Link href={link.url} title={link.title} className={cls}>
          {link.title}
        </Link>
          )}
    </li>
  )
}
