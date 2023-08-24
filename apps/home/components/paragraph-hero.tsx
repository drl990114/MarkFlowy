import classNames from 'classnames'

import { SectionHeader } from '@/components/section-header'

export function ParagraphHero({
  paragraph,
  ...props
}: {
  paragraph: Paragraph
}) {
  return (
    <section
      data-cy="paragraph-hero"
      className={classNames(
        'min-h-screen flex  bg-gray-50 items-center pt-18 md:pt-20 lg:pt-20 pb-8 md:pb-12 lg:pb-20',
      )}
      {...props}
    >
      <SectionHeader
        level={1}
        heading={paragraph.field_heading}
        text={paragraph.field_text}
      />
    </section>
  )
}
