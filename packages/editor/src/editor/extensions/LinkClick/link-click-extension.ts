import type { CreateExtensionPlugin } from '@rme-sdk/core'
import { PlainExtension, extension } from '@rme-sdk/core'
import { isBrowser } from '../../utils/common'

export type LinkClickHandler = (href: string, event: MouseEvent) => void | boolean

export interface LinkClickOptions {
  handleLinkClick?: LinkClickHandler
}

@extension<LinkClickOptions>({
  defaultOptions: {},
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class LinkClickExtension extends PlainExtension<LinkClickOptions> {
  get name() {
    return 'linkClick' as const
  }

  createPlugin(): CreateExtensionPlugin {
    return {
      props: {
        handleClick: (view, pos, event) => {
          if (!isBrowser()) {
            return false
          }

          const target = event.target as HTMLElement
          const linkElement = target.closest('a')

          if (!linkElement) {
            return false
          }

          const href = linkElement.getAttribute('href')
          if (!href) {
            return false
          }

          event.preventDefault()
          event.stopPropagation()

          return true
        },
      },
    }
  }
}
