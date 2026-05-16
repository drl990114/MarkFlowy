/* eslint-disable @typescript-eslint/no-shadow */
import type {
  ApplySchemaAttributes,
  CommandFunction,
  DelayedPromiseCreator,
  EditorView,
  InputRule,
  NodeExtensionSpec,
  NodeSpecOverride,
  PrimitiveSelection,
  ProsemirrorAttributes,
} from '@rme-sdk/core'
import {
  ErrorConstant,
  extension,
  ExtensionTag,
  getTextSelection,
  invariant,
  isElementDomNode,
  NodeExtension,
  nodeInputRule,
  omitExtraAttributes
} from '@rme-sdk/core'
import type { ComponentType } from 'react'
import type { ExtensionsOptions } from '..'
import { getHtmlImageInputRule } from '../../inline-input-regex'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import { buildHtmlStringFromAst } from '../../utils/html'
import type { ImageNodeViewProps } from './image-nodeview'
import { ImageNodeView } from './image-nodeview'

type DelayedImage = DelayedPromiseCreator<ImageAttributes>

export interface ImageOptions {
  createPlaceholder?: (view: EditorView, pos: number) => HTMLElement
  updatePlaceholder?: (
    view: EditorView,
    pos: number,
    element: HTMLElement,
    progress: number,
  ) => void
  handleViewImgSrcUrl?: ExtensionsOptions['handleViewImgSrcUrl']
  imagePasteHandler?: ExtensionsOptions['imagePasteHandler']
  destroyPlaceholder?: (view: EditorView, element: HTMLElement) => void
  /**
   * The upload handler for the image extension.
   *
   * It receives a list of dropped or pasted files and returns a promise for the
   * attributes which should be used to insert the image into the editor.
   *
   * @param files - a list of files to upload.
   * @param setProgress - the progress handler.
   */
  uploadHandler?: (files: FileWithProgress[]) => DelayedImage[]

  /**
   * The image hosting service upload handler.
   * It receives the image src and returns a promise for the new src after uploading to image hosting service.
   *
   * @param src - the original image src
   * @returns Promise<string> - the new image src after uploading
   */
  imageHostingHandler?: (src: string) => Promise<string>

  /**
   * When pasting mixed text and image content (usually from Microsoft Office products) the content on the clipboard is either:
   *
   * a. one large image: containing effectively a screenshot of the original content (an image with text in it).
   * b. HTML content: containing usable text, but images with file protocol URLs (which cannot be resolved due to browser security restrictions).
   *
   * If true, this will extract the text from the clipboard data, and drop the images.
   * If false, the "screenshot" image will be used and the text will be dropped.
   *
   * @defaultValue true
   */
  preferPastedTextContent?: boolean
}

interface FileWithProgress {
  file: File
  progress: SetProgress
}

/**
 * Set the progress.
 *
 * @param progress - a value between `0` and `1`.
 */
type SetProgress = (progress: number) => void

/**
 * The image extension for placing images into your editor.
 *
 * TODO ->
 * - Captions https://glitch.com/edit/#!/pet-figcaption?path=index.js%3A27%3A1 into a preset
 *
 * TODO => Split this into an image upload extension and image extension.
 * - Add a base64 image
 */
@extension<ImageOptions>({
  defaultOptions: {
    createPlaceholder,
    handleViewImgSrcUrl: async (src: string) => src,
    updatePlaceholder: () => {},
    destroyPlaceholder: () => {},
    uploadHandler,
    imageHostingHandler: async (src: string) => src,
    preferPastedTextContent: true,
    defaultInlineNode: 'div',
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class HtmlImageExtension extends NodeExtension<ImageOptions> {
  get name() {
    return 'html_image' as const
  }

  ReactComponent: ComponentType<ImageNodeViewProps> | undefined = (props) => {
    const { handleViewImgSrcUrl, imageHostingHandler, imagePasteHandler } = this.options

    return (
      <ImageNodeView
        handleViewImgSrcUrl={handleViewImgSrcUrl}
        imagePasteHandler={imagePasteHandler}
        imageHostingHandler={imageHostingHandler}
        {...props}
      />
    )
  }

  createTags() {
    return [ExtensionTag.InlineNode, ExtensionTag.Media]
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    const { preferPastedTextContent } = this.options
    return {
      inline: true,
      selectable: true,
      atom: true,
      ...override,
      attrs: {
        ...extra.defaults(),
        alt: { default: '' },
        crop: { default: null },
        height: { default: null },
        width: { default: null },
        rotate: { default: null },
        src: { default: null },
        title: { default: '' },
        'data-file-name': { default: null },
        'data-rme-loading': { default: null },
        'data-rme-from-paste': { default: null },
      },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs: (element) => {
            if (isElementDomNode(element)) {
              const attrs = getImageAttributes({ element, parse: extra.parse })

              if (preferPastedTextContent && attrs.src?.startsWith('file:///')) {
                return false
              }

              return attrs
            }

            return {}
          },
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM: (node) => {
        const attrs = omitExtraAttributes(node.attrs, extra)
        return ['img', { ...extra.dom(node), ...attrs }]
      },
    }
  }

  insertImage(attributes: ImageAttributes, selection?: PrimitiveSelection): CommandFunction {
    return ({ tr, dispatch }) => {
      const { from, to } = getTextSelection(selection ?? tr.selection, tr.doc)
      const node = this.type.create(attributes)

      dispatch?.(tr.replaceRangeWith(from, to, node))

      return true
    }
  }

  createInputRules(): InputRule[] {
    return  getHtmlImageInputRule(this.type).map(nodeInputRule)
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.inline,
        token: 'html_image',
        node: this.name,
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    state.text(
      buildHtmlStringFromAst({
        tag: 'img',
        attrs: node.attrs,
        voidElement: true,
      }),
      false,
    )
  }
}

export type ImageAttributes = ProsemirrorAttributes<ImageExtensionAttributes>

export interface ImageExtensionAttributes {
  align?: 'center' | 'end' | 'justify' | 'left' | 'match-parent' | 'right' | 'start'
  alt?: string
  height?: string | number
  width?: string | number
  rotate?: string
  src: string
  title?: string

  /** The file name used to create the image. */
  'data-file-name'?: string
}

/**
 * The set of valid image files.
 */
const IMAGE_FILE_TYPES = new Set([
  'image/jpeg',
  'image/gif',
  'image/png',
  'image/jpg',
  'image/svg',
  'image/webp',
])

/**
 * True when the provided file is an image file.
 */
export function isImageFileType(file: File): boolean {
  return IMAGE_FILE_TYPES.has(file.type)
}

/**
 * Get the width and the height of the image.
 */
function getDimensions(element: HTMLElement) {
  let { width, height } = element.style
  width = width || element.getAttribute('width') || ''
  height = height || element.getAttribute('height') || ''

  return { width, height }
}

/**
 * Retrieve attributes from the dom for the image extension.
 */
function getImageAttributes({
  element,
  parse,
}: {
  element: HTMLElement
  parse: ApplySchemaAttributes['parse']
}) {
  const { width, height } = getDimensions(element)

  return {
    ...parse(element),
    alt: element.getAttribute('alt') ?? '',
    height: Number.parseInt(height || '0', 10) || null,
    src: element.getAttribute('src') ?? null,
    title: element.getAttribute('title') ?? '',
    width: Number.parseInt(width || '0', 10) || null,
    'data-file-name': element.getAttribute('data-file-name') ?? null,
  }
}

function createPlaceholder(): HTMLElement {
  const element = document.createElement('div')

  return element
}

/**
 * The default handler converts the files into their `base64` representations
 * and adds the attributes before inserting them into the editor.
 */
function uploadHandler(files: FileWithProgress[]): DelayedImage[] {
  invariant(files.length > 0, {
    code: ErrorConstant.EXTENSION,
    message: 'The upload handler was applied for the image extension without any valid files',
  })

  let completed = 0
  const promises: DelayedPromiseCreator<ImageAttributes>[] = []

  for (const { file, progress } of files) {
    promises.push(
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      () =>
        new Promise<ImageAttributes>((resolve) => {
          const reader = new FileReader()

          reader.addEventListener(
            'load',
            (readerEvent) => {
              completed += 1
              progress(completed / files.length)
              resolve({ src: readerEvent.target?.result as string, 'data-file-name': file.name })
            },
            { once: true },
          )

          reader.readAsDataURL(file)
        }),
    )
  }

  return promises
}
