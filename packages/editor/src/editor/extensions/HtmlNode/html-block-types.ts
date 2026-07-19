import type { ExtensionsOptions } from '../index'
import type { LivePreviewBlockCommonOptions } from '../LivePreviewBlock'

export interface LineHtmlBlockExtensionOptions extends LivePreviewBlockCommonOptions {
  handleViewImgSrcUrl?: ExtensionsOptions['handleViewImgSrcUrl']
}
