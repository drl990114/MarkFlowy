import { allMarkdowns, Markdown } from 'contentlayer/generated'

export const getSections = () => {
  const sections: Record<string, Markdown[]> = {}

  allMarkdowns.forEach((markdown) => {
    const slug = markdown.slug
    const section = slug.split('/')[0]
    if (!sections[section]) {
      sections[section] = []
    }
    sections[section].push(markdown)
  })

  return sections
}
