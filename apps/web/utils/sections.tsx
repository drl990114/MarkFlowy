import { allMarkdowns, type Markdown } from 'contentlayer/generated'

export const getSections = (locale?: string) => {
  const sections: Record<string, Markdown[]> = {}
  const documentLocale = locale && allMarkdowns.some((markdown) => markdown.locale === locale)
    ? locale
    : locale ? 'en' : undefined

  allMarkdowns.forEach((markdown) => {
    const slug = markdown.slug
    const pathParts = slug.split('/')
    const docLocale = markdown.locale 

    // Filter by locale if specified
    if (documentLocale && docLocale !== documentLocale) {
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
