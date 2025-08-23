import { allMarkdowns, Markdown } from 'contentlayer/generated'

export const getSections = (locale?: string) => {
  const sections: Record<string, Markdown[]> = {}

  allMarkdowns.forEach((markdown) => {
    const slug = markdown.slug
    const pathParts = slug.split('/')
    const docLocale = markdown.locale 

    // Filter by locale if specified
    if (locale && docLocale !== locale) {
      return
    }

    const section = pathParts[1] || docLocale
    if (!sections[section]) {
      sections[section] = []
    }
    sections[section].push(markdown)
  })

  return sections
}
