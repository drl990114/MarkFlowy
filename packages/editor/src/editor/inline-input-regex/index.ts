import { NodeType } from '@rme-sdk/pm'
import { getAttrsBySignalHtmlContent } from '../utils/html'

export const getMdImageInputRule = <T extends NodeType | string>(nodeType: T) => [
  {
    regexp: /!\[([^\]]*)\]\(([^\s"]+(?:\s+[^\s"]+)*)?(?:\s+"(.*?)")?\)/,
    type: nodeType,
    getAttributes: (match: string[]) => {
      const [, alt, src, title] = match
      return { alt, src, title }
    },
  },
]

export const getHtmlImageInputRule = <T extends NodeType | string>(nodeType: T) => [
  {
    regexp: new RegExp('<img[^>]*>'),
    type: nodeType,
    getAttributes: (match: string[]) => {
      return getAttrsBySignalHtmlContent(match[0])
    },
  },
]

export const getInlineMathInputRule = <T extends NodeType | string>(nodeType: T) => [
  {
    regexp: /\$\$([^$\n]+?)\$\$(?!\$)/,
    type: nodeType,
    getAttributes: (match: string[]) => {
      return { tex: match[1] ?? '', fromInput: true, display: true }
    },
  },
  {
    regexp: /<span[^>]*data-type=["']math-inline["'][^>]*><\/span>/,
    type: nodeType,
    getAttributes: () => ({ fromInput: false }),
  },
  {
    regexp: /\$([^$\n]+?)\$/,
    type: nodeType,
    getAttributes: (match: string[]) => {
      return { tex: match[1] ?? '', fromInput: true, display: false }
    },
  },
]
