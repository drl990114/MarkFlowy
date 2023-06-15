import classNames from "classnames"

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  backgroundColor?: string
  children?: React.ReactNode
}

export function Section({ backgroundColor, children, ...props }: SectionProps) {
  return (
    <section
      className={classNames("py-8 md:py-12 lg:py-20", backgroundColor)}
      {...props}
    >
      {children}
    </section>
  )
}
