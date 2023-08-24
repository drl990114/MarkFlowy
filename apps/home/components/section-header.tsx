import { Links } from './links'

interface SectionHeaderProps {
  level?: number
  heading: string
  text: string
  links?: LinksProps['links']
}

export function SectionHeader({
  level = 2,
  heading,
  text,
  links,
  ...props
}: SectionHeaderProps) {
  const HeadingLevel = `h${level}` as keyof JSX.IntrinsicElements
  return (
    <div className="container px-6 mx-auto text-center" {...props}>
      {heading && (
        <HeadingLevel className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
          {heading}
        </HeadingLevel>
      )}
      <div
        data-cy="node--body"
        className="max-w-xl mx-auto mt-2 text-gray-400 sm:text-xl md:text-xl"
      >
        {text}
      </div>
      {links?.length ? <Links links={links} /> : null}
    </div>
  )
}
