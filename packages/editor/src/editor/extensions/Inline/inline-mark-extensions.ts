import type {
  ExtensionCommandReturn,
  MarkExtensionSpec,
  NodeView,
  NodeViewMethod,
} from '@rme-sdk/core'
import { MarkExtension, extension } from '@rme-sdk/core'
import { isBrowser } from '../../utils/common'

import { formatHref } from './format-href'
import { toggleInlineMark } from './inline-mark-commands'

const commonAttrs = {
  depth: { default: 0 },
  ignoreWhenCopy: { default: false },
  linkHref: { default: null }
}
const endpointAttrs = {
  depth: { default: 0 },
  first: { default: false },
  last: { default: false },
  class: { default: '' },
  ignoreWhenCopy: { default: false },
  linkHref: { default: null }
}

class MetaKey extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdMark' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      inclusive: false,
      attrs: endpointAttrs,
      toDOM: (mark) => {
        return ['span', { class: 'md-mark', 'data-ignore-when-copy': mark.attrs.ignoreWhenCopy }, 0]
      },
    }
  }

  createCommands() {
    return {
      toggleInlineMark: toggleInlineMark,
    }
  }
}

class PlainText extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdText' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: endpointAttrs,
      toDOM: (mark) => ['span', { class: mark.attrs.class }, 0],
    }
  }
}

class Emphasis extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdEm' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: commonAttrs,
      toDOM: () => ['em', 0],
    }
  }

  createCommands(): ExtensionCommandReturn {
    return {
      toggleEmphasis: () => (props) => toggleInlineMark(this.name)(props),
    }
  }
}

class Strong extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdStrong' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: commonAttrs,
      toDOM: () => ['strong', 0],
    }
  }

  createCommands(): ExtensionCommandReturn {
    return {
      toggleStrong: () => (props) => toggleInlineMark(this.name)(props),
    }
  }
}

class CodeText extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdCodeText' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: commonAttrs,
      toDOM: () => ['code', 0],
    }
  }

  createCommands(): ExtensionCommandReturn {
    return {
      toggleCodeText: () => (props) => toggleInlineMark(this.name)(props),
    }
  }
}

class CodeSpace extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdCodeSpace' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: commonAttrs,
      toDOM: () => ['span', 0],
    }
  }
}

class Delete extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdDel' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: commonAttrs,
      toDOM: () => ['del', 0],
    }
  }

  createCommands(): ExtensionCommandReturn {
    return {
      toggleDelete: () => (props) => toggleInlineMark(this.name)(props),
    }
  }
}

class LinkText extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdLinkText' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: {
        ...commonAttrs,
        href: {
          default: '',
        },
      },
      toDOM: (mark) => [
        'a',
        {
          href: mark.attrs.href,
        },
        0,
      ],
    }
  }
}

class LinkUri extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdLinkUri' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      spanning: false,
      attrs: commonAttrs,
      toDOM: (mark) => [
        'a',
        { class: 'md-link', 'data-ignore-when-copy': mark.attrs.ignoreWhenCopy },
        0,
      ],
    }
  }
}

class ImgText extends MarkExtension {
  static disableExtraAttributes = true
  get name() {
    return 'mdImgText' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      spanning: false,
      attrs: commonAttrs,
      toDOM: () => ['span', { class: 'md-img-text' }, 0],
    }
  }
}

export interface MfImgOptions {
  handleViewImgSrcUrl?: (src: string) => Promise<string>
}

const globalImageHrefCache: Map<string, string> = new Map()

@extension<MfImgOptions>({
  defaultOptions: {
    handleViewImgSrcUrl: async (src: string) => src,
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
class ImgUri extends MarkExtension<MfImgOptions> {
  static disableExtraAttributes = true
  get name() {
    return 'mdImgUri' as const
  }
  createMarkSpec(): MarkExtensionSpec {
    return {
      spanning: false,
      attrs: {
        ...commonAttrs,
        key: {
          default: '',
        },
        href: {
          default: '',
        },
      },
      toDOM: (mark) => ['img', { src: mark.attrs.href }, 0],
    }
  }

  createNodeViews = (): NodeViewMethod => {
    return (mark): NodeView => {
      if (!isBrowser()) {
        return { dom: document.createElement('span') as any }
      }
      const innerContainer = document.createElement('span')

      const img = document.createElement('img')
      if (this.options.handleViewImgSrcUrl) {
        this.options.handleViewImgSrcUrl(mark.attrs.href).then((newHref) => {
          img.setAttribute('src', formatHref(newHref))
          globalImageHrefCache.set(mark.attrs.href, newHref)
        })
      } else {
        img.setAttribute('src', formatHref(mark.attrs.href))
      }

      const outerContainer = document.createElement('span')
      outerContainer.appendChild(img)
      outerContainer.appendChild(innerContainer)
      outerContainer.setAttribute('class', 'md-img-uri')

      return { dom: outerContainer, contentDOM: innerContainer }
    }
  }
}

const autoHideMarks: Record<string, true> = {
  mdMark: true,
  mdLinkUri: true,
  mdImgText: true,
  mdHtmlInline: true,
}

export function isAutoHideMark(name: string): boolean {
  // This should be the fastest way based on my performance test.
  return autoHideMarks[name]
}

type LineMarkExtensionOptions = {
  handleViewImgSrcUrl?: (src: string) => Promise<string>
}

export const markExtensions = (options: LineMarkExtensionOptions = {}) => [
  new MetaKey(),
  new PlainText(),
  new Emphasis(),
  new Strong(),
  new CodeText(),
  new CodeSpace(),
  new Delete(),
  new LinkText(),
  new LinkUri(),
  new ImgText(),
  // new ImgUri({
  //   handleViewImgSrcUrl: options.handleViewImgSrcUrl,
  // }),
  // new HtmlInlineMarks(),
]
export type LineMarkExtension = ReturnType<typeof markExtensions>[number]
export type LineMarkName = LineMarkExtension['name']
export type LineMarkAttrs = {
  depth: number

  first?: boolean
  last?: boolean

  href?: string

  ignoreWhenCopy?: boolean

  htmlText?: string

  /**
   * to fix same attrs node only render once
   */
  key?: string

  /**
   * class name
   */
  class?: string
}
