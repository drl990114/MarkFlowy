import { ParagraphProps } from '@/components/paragraph'
import { Section } from '@/components/section'
import { SectionHeader } from '@/components/section-header'

export function ParagraphCards({ paragraph, ...props }: ParagraphProps) {
  return (
    <Section backgroundColor={paragraph.field_background_color === 'muted' ? 'bg-gray-50' : ''} {...props}>
      <SectionHeader heading={paragraph.field_heading} text={paragraph.field_text}  />
      <div className="container px-6 mx-auto">
        {paragraph.field_items?.length && (
          <div className="grid justify-center gap-20 pt-20 lg:grid-cols-3">
            {paragraph.field_items.map((card) => (
              <div key={card.id} className="max-w-sm text-center lg:max-w-none">
                <h3 className="text-2xl font-bold">{card.field_heading}</h3>
                {card.field_text && <div className="pt-2 text-lg"> {card.field_text}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
