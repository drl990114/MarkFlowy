import type { LinkProps as NextLinkProps } from 'next/link'
import NextLink from 'next/link'
import { useRouter } from 'next/router'

interface LinkProps extends NextLinkProps {
  href: string
}

export function Link({ href, passHref, as, children, ...props }: PropsWithChildren<LinkProps>) {
  const router = useRouter()

  if (!href) {
    return null
  }

  const linkProps = router.isPreview ? { prefetch: false, ...props } : props

  return (
    <NextLink as={as} href={href} passHref={passHref} {...linkProps}>
      {children}
    </NextLink>
  )
}
