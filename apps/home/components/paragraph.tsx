import { ParagraphCards } from '@/components/paragraph-cards'
import { ParagraphFAQ } from '@/components/paragraph-faq'
import { ParagraphFeature } from '@/components/paragraph-feature'
import { ParagraphHero } from '@/components/paragraph-hero'

const paragraphTypes = {
  hero: ParagraphHero,
  faq: ParagraphFAQ,
  feature: ParagraphFeature,
  cards: ParagraphCards,
}

export interface ParagraphProps {
  paragraph: Paragraph
}

export function Paragraph({ paragraph, ...props }: ParagraphProps) {
  if (!paragraph) {
    return null
  }

  const Component = paragraphTypes[paragraph.type]

  if (!Component) {
    return null
  }

  return <Component paragraph={paragraph} {...props} />
}
