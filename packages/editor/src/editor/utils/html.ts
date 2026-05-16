// @ts-nocheck
import HTML from 'html-parse-stringify'

export function isClosingTag(str: string) {
  const regex = /^<\/[a-zA-Z0-9]+\s*>$/
  return regex.test(str)
}

export function isSingleNode (html: string) {
  const ast = HTML.parse(html)
  return ast && ast.length === 1
}

export const getAttrsBySignalHtmlContent = (html: string) => {
  const ast = HTML.parse(html)
  return ast[0]?.attrs || {}
}

export function getTagName(str: string) {
  const regex = /<\/?([a-zA-Z0-9]+)\b[^>]*>/

  const matches = regex.exec(str)

  if (matches && matches.length > 1) {
    return matches[1].toLowerCase()
  }

  return ''
}

export function isImageElement(el: any): el is HTMLImageElement {
  return el && (el.tagName as string)?.toLocaleUpperCase() === 'IMG'
}

interface HTMLAst {
  tag: string
  attrs: Record<string, string> | undefined
  voidElement: boolean
}

export function buildMarkdownTextFromNode(node: { attrs: { [key: string]: any } }) {
  const { attrs } = node

  // 如果是引用图片，生成引用语法
  if (attrs['data-refer-label']) {
    const alt = attrs.alt || ''
    return `![${alt}][${attrs['data-refer-label']}]`
  }

  // 否则生成标准的 Markdown 图片语法
  const alt = attrs.alt || ''
  const src = attrs.src || ''
  const title = attrs.title ? ` "${attrs.title}"` : ''
  return `![${alt}](${src}${title})`
}

export function buildHtmlStringFromAst(ast: HTMLAst) {
  let attrs = ''

  if (ast.attrs) {
    const filteredAttrs = Object.entries(ast.attrs).filter(([, value]) => value)

    if (filteredAttrs.length) {
      attrs = `${filteredAttrs.map(([key, value]) => `${key}="${value}"`).join(' ')}`
    }
  }

  if (ast.voidElement) {
    return `<${ast.tag} ${attrs} />`
  }

  return `<${ast.tag} ${attrs}></${ast.tag}>`
}
