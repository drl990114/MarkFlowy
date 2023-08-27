export function isClosingTag(str: string) {
  const regex = /^<\/[a-zA-Z0-9]+\s*>$/
  return regex.test(str)
}

export function getTagName(str: string) {
  const regex = /<\/?([a-zA-Z0-9]+)\b[^>]*>/

  const matches = regex.exec(str)

  if (matches && matches.length > 1) {
    return matches[1].toLowerCase()
  }

  return ''
}
