import type { ParagraphProps } from '@/components/paragraph'
import { Section } from '@/components/section'
import { SectionHeader } from '@/components/section-header'

export function ParagraphFAQ({ paragraph, ...props }: ParagraphProps) {
  return (
    <Section
      data-cy="paragraph-faq"
      backgroundColor={
        paragraph.field_background_color === 'muted' ? 'bg-gray-50' : ''
      }
      {...props}
    >
      <SectionHeader
        heading={paragraph.field_heading}
        text={paragraph.field_text}
        links={paragraph.field_links}
      />
      <div className="container px-6 mx-auto">
        {paragraph.field_items && (
          <div className="grid gap-8 pt-10 md:py-20 md:gap-12 lg:gap-20 md:grid-cols-2">
            {paragraph.field_items.map(card => (
              <div key={card.id}>
                <h3 className="text-xl font-semibold md:text-2xl">
                  {card.field_heading}
                </h3>
                {card.field_text && (
                  <div className="mt-2 leading-relaxed">{card.field_text}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
