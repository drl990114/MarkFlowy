import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { prosemirrorNodeToHtml } from '@rme-sdk/sdk'
import { DOMSerializer } from '@rme-sdk/sdk/pm/model'
import type { Node as ProsemirrorNode } from '@rme-sdk/sdk/pm/model'
import { classHighlighter, highlightCode } from '@lezer/highlight'
import { normalizeReference } from 'markdown-it/lib/common/utils.mjs'
import { nanoid } from 'nanoid'
import type { EditorProps } from '../components'
import { createHtmlRenderer } from '../extensions/LivePreviewBlock/renderers/html-renderer'
import { createMathRenderer } from '../extensions/LivePreviewBlock/renderers/math-renderer'
import { createMermaidRenderer } from '../extensions/LivePreviewBlock/renderers/mermaid-renderer'
import type {
  LivePreviewRenderContext,
  LivePreviewRenderer,
} from '../extensions/LivePreviewBlock/live-preview-types'
import { tex2svgDisplay, tex2svgInline } from '../extensions/Math/mathjax'
import {
  clearPreviewImageSource,
  createInertPreviewImageAttributes,
  getPreviewImageSource,
  sanitizeGeneratedHtml,
  sanitizeImageSource,
  sanitizeMarkdownHtml,
} from './sanitize-html'

type DelegateOptions = EditorProps['delegateOptions']

type ReferenceDefinition = {
  href: string
  title: string
}

export interface EnhancePreviewHtmlOptions {
  delegateOptions?: DelegateOptions
  referenceDefinitions?: ReadonlyMap<string, ReferenceDefinition>
}

export interface PreparedProsemirrorPreview {
  html: string
  /**
   * Sources stay outside live HTML until the host resolves them. The HTML
   * contains only inert image placeholders keyed by their random ids.
   */
  imageSources: ReadonlyMap<string, string>
}

const staticRenderContext = {} as LivePreviewRenderContext

type TrustedAttribute = readonly [name: string, value: string]

interface TrustedPreviewState {
  attributesByToken: ReadonlyMap<string, readonly TrustedAttribute[]>
  nodesByToken: ReadonlyMap<string, Element>
}

function protectTrustedPreviewAttributes(
  root: DocumentFragment,
): TrustedPreviewState {
  const attributesByToken = new Map<string, readonly TrustedAttribute[]>()
  const nodesByToken = new Map<string, Element>()

  root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input) => {
    const token = nanoid()
    const placeholder = document.createElement('span')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = input.checked
    checkbox.toggleAttribute('checked', input.checked)
    checkbox.disabled = true
    placeholder.dataset.mfPreviewTrustedNode = token
    nodesByToken.set(token, checkbox)
    input.replaceWith(placeholder)
  })

  root.querySelectorAll<HTMLElement>('*').forEach((element) => {
    if (element.dataset.mfPreviewTrustedNode) {
      return
    }

    const attributes = Array.from(element.attributes)
      .filter(
        ({ name }) =>
          name === 'class' ||
          (name.startsWith('data-') && !name.startsWith('data-mf-preview-')),
      )
      .map(({ name, value }) => [name, value] as const)
    if (!attributes.length) {
      return
    }

    const token = nanoid()
    attributes.forEach(([name]) => element.removeAttribute(name))
    element.dataset.mfPreviewTrusted = token
    attributesByToken.set(token, attributes)
  })

  return { attributesByToken, nodesByToken }
}

function restoreTrustedPreviewAttributes(
  html: string,
  state: TrustedPreviewState,
): string {
  const template = document.createElement('template')
  template.innerHTML = html

  template.content
    .querySelectorAll<HTMLElement>('[data-mf-preview-trusted]')
    .forEach((element) => {
      const token = element.dataset.mfPreviewTrusted || ''
      const attributes = state.attributesByToken.get(token)
      element.removeAttribute('data-mf-preview-trusted')
      attributes?.forEach(([name, value]) => element.setAttribute(name, value))
    })
  template.content
    .querySelectorAll<HTMLElement>('[data-mf-preview-trusted-node]')
    .forEach((placeholder) => {
      const token = placeholder.dataset.mfPreviewTrustedNode || ''
      const node = state.nodesByToken.get(token)
      if (node) {
        placeholder.replaceWith(node.cloneNode(true))
      } else {
        placeholder.remove()
      }
    })

  return template.innerHTML
}

function getDirectCodeElement(block: HTMLElement): HTMLElement | null {
  const code = block.firstElementChild
  return code?.tagName === 'CODE' ? (code as HTMLElement) : null
}

function getBlockSource(block: HTMLElement): string {
  return getDirectCodeElement(block)?.textContent ?? block.textContent ?? ''
}

function preparePreviewHtml(html: string, preserveImageSources: boolean): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const markers = Array.from(
    template.content.querySelectorAll<HTMLElement>('[data-type="html-inline"][data-html]'),
  )

  const replacements = markers.map((marker) => {
    const placeholder = `mf-inline-html-${nanoid()}`
    const inlineHtml = marker.dataset.html || ''
    marker.replaceWith(document.createTextNode(placeholder))
    return { html: inlineHtml, placeholder }
  })
  const trustedState = protectTrustedPreviewAttributes(template.content)

  let restoredHtml = template.innerHTML
  replacements.forEach((replacement) => {
    restoredHtml = restoredHtml.split(replacement.placeholder).join(replacement.html)
  })
  const sanitizedHtml = sanitizeMarkdownHtml(restoredHtml, { preserveImageSources })
  return restoreTrustedPreviewAttributes(sanitizedHtml, trustedState)
}

function restoreListOrderStyles(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('[data-list-order]').forEach((listItem) => {
    const order = Number.parseInt(listItem.dataset.listOrder || '', 10)
    if (Number.isSafeInteger(order)) {
      listItem.style.setProperty('--prosemirror-flat-list-order', String(order))
    }
  })
}

function renderBlockError(container: HTMLElement, error: unknown): void {
  const errorElement = document.createElement('pre')
  errorElement.className = 'mf-preview-error'
  errorElement.textContent = error instanceof Error ? error.message : String(error)
  container.classList.add('mf-preview-block-error')
  container.replaceChildren(errorElement)
}

async function renderBlock(
  sourceElement: HTMLElement,
  type: 'html' | 'math' | 'mermaid',
  renderer: LivePreviewRenderer,
  source = getBlockSource(sourceElement),
): Promise<void> {
  const container = document.createElement('div')
  container.className = `mf-preview-block mf-preview-${type}`
  sourceElement.replaceWith(container)

  try {
    await renderer.render(source, container, staticRenderContext)
  } catch (error) {
    renderBlockError(container, error)
  }
}

function renderInlineMath(container: HTMLElement): void {
  const mathNodes = Array.from(
    container.querySelectorAll<HTMLElement>('[data-type="math-inline"]'),
  )

  mathNodes.forEach((mathNode) => {
    const tex = (mathNode.dataset.tex || '').replace(/\u200b/g, '').trim()
    const display = mathNode.dataset.display === 'true'
    const rendered = document.createElement(display ? 'div' : 'span')
    rendered.className = display
      ? 'mf-preview-math-inline mf-preview-math-display'
      : 'mf-preview-math-inline'

    if (tex) {
      const html = display ? tex2svgDisplay(tex) : tex2svgInline(tex)
      rendered.innerHTML = sanitizeGeneratedHtml(html)
    }

    mathNode.replaceWith(rendered)
  })
}

function getCodeLanguage(block: HTMLElement, code: HTMLElement): string {
  const classLanguage = Array.from(code.classList)
    .find((className) => className.startsWith('language-'))
    ?.slice('language-'.length)
  const rawLanguage = block.dataset.language || classLanguage || ''

  return rawLanguage.trim().split(/\s+/, 1)[0] || ''
}

async function highlightCodeBlock(block: HTMLElement): Promise<void> {
  const code = getDirectCodeElement(block)
  if (!code) {
    return
  }

  block.classList.add('mf-preview-code-block')
  code.classList.add('mf-preview-code')

  const languageName = getCodeLanguage(block, code)
  if (!languageName) {
    return
  }

  const description = LanguageDescription.matchLanguageName(languages, languageName, false)
  if (!description) {
    return
  }

  try {
    const source = code.textContent || ''
    const support = await description.load()
    const tree = support.language.parser.parse(source)
    const fragment = document.createDocumentFragment()

    highlightCode(
      source,
      tree,
      classHighlighter,
      (text, classes) => {
        if (!classes) {
          fragment.append(document.createTextNode(text))
          return
        }

        const token = document.createElement('span')
        token.className = classes
        token.textContent = text
        fragment.append(token)
      },
      () => fragment.append(document.createTextNode('\n')),
    )

    code.replaceChildren(fragment)
    block.dataset.language = languageName
  } catch {
    // An unknown or failed language loader should leave the original source readable.
  }
}

function getResolvedImageSource(
  image: HTMLImageElement,
  referenceDefinitions: ReadonlyMap<string, ReferenceDefinition>,
): string | null {
  let source = getPreviewImageSource(image)
  const referenceLabel = image.dataset.referLabel
  if (referenceLabel) {
    const definition = referenceDefinitions.get(normalizeReference(referenceLabel))
    if (definition) {
      source = definition.href
      if (definition.title) {
        image.setAttribute('title', definition.title)
      }
    }
    image.removeAttribute('data-refer-label')
  }

  if (!source) {
    clearPreviewImageSource(image)
    image.removeAttribute('src')
    return null
  }

  return source
}

async function resolveImage(
  image: HTMLImageElement,
  delegateOptions: DelegateOptions,
  referenceDefinitions: ReadonlyMap<string, ReferenceDefinition>,
): Promise<void> {
  const source = getResolvedImageSource(image, referenceDefinitions)
  if (!source) {
    return
  }

  if (delegateOptions?.handleViewImgSrcUrl) {
    try {
      image.setAttribute('src', await delegateOptions.handleViewImgSrcUrl(source))
      clearPreviewImageSource(image)
    } catch {
      clearPreviewImageSource(image)
      image.removeAttribute('src')
    }
    return
  }

  const safeSource = sanitizeImageSource(source)
  if (safeSource) {
    image.setAttribute('src', safeSource)
  } else {
    image.removeAttribute('src')
  }
  clearPreviewImageSource(image)
}

function deferImageResolution(
  image: HTMLImageElement,
  delegateOptions: DelegateOptions,
  referenceDefinitions: ReadonlyMap<string, ReferenceDefinition>,
  imageSources: Map<string, string>,
): void {
  const source = getResolvedImageSource(image, referenceDefinitions)
  if (!source) {
    return
  }

  if (!delegateOptions?.handleViewImgSrcUrl) {
    const safeSource = sanitizeImageSource(source)
    if (safeSource) {
      image.setAttribute('loading', 'lazy')
      image.setAttribute('decoding', 'async')
      image.setAttribute('src', safeSource)
    } else {
      image.removeAttribute('src')
    }
    clearPreviewImageSource(image)
    return
  }

  let imageId = image.dataset.mfPreviewImageId
  if (!imageId) {
    const attributes = createInertPreviewImageAttributes(source)
    imageId = attributes['data-mf-preview-image-id']
    image.setAttribute('src', attributes.src)
    image.dataset.mfPreviewImageId = imageId
  }
  delete image.dataset.mfPreviewImageSource
  imageSources.set(imageId, source)
}

function collectReferenceDefinitions(doc: ProsemirrorNode): Map<string, ReferenceDefinition> {
  const definitions = new Map<string, ReferenceDefinition>()

  doc.forEach((child) => {
    if (child.type.name !== 'reference_def') {
      return
    }

    let label = ''
    let href = ''
    let title = ''
    child.forEach((contentNode) => {
      if (contentNode.type.name === 'reference_label') {
        label = contentNode.textContent
      } else if (contentNode.type.name === 'reference_href') {
        href = contentNode.textContent
      } else if (contentNode.type.name === 'reference_title') {
        title = contentNode.textContent
      }
    })

    if (label && href) {
      definitions.set(normalizeReference(label), { href, title })
    }
  })

  return definitions
}

function serializePreviewDocument(doc: ProsemirrorNode): string {
  const defaultSerializer = DOMSerializer.fromSchema(doc.type.schema)
  const serializer = new DOMSerializer(
    {
      ...defaultSerializer.nodes,
      codeMirror: (node) => {
        const language = String(node.attrs.language || '').trim()
        return [
          'pre',
          {
            'data-type': 'code-block',
            'data-language': language || undefined,
            'data-front-matter': node.attrs['front-matter'] === true ? 'true' : undefined,
          },
          ['code', 0],
        ]
      },
      html_block: () => ['pre', { 'data-type': 'html-block' }, ['code', 0]],
      html_inline_node: (node) => [
        'span',
        {
          class: 'inline-input-render',
          'data-type': 'html-inline',
          'data-html': node.attrs.htmlText || '',
        },
      ],
      html_image: (node) => [
        'img',
        {
          ...node.attrs,
          src: undefined,
          ...(node.attrs.src
            ? createInertPreviewImageAttributes(String(node.attrs.src))
            : {}),
        },
      ],
      math_block: (node) => [
        'div',
        {
          'data-type': 'math-block',
          'data-tex': String(node.attrs.tex || '') || undefined,
        },
        0,
      ],
      md_image: (node) => [
        'img',
        {
          ...node.attrs,
          src: undefined,
          ...(node.attrs.src
            ? createInertPreviewImageAttributes(String(node.attrs.src))
            : {}),
        },
      ],
    },
    defaultSerializer.marks,
  )
  const container = document.createElement('div')
  container.append(serializer.serializeFragment(doc.content, { document }))
  return container.innerHTML
}

/**
 * @internal Accepts only HTML produced by the editor's ProseMirror serializer.
 * User-authored HTML must enter through the marked HTML nodes so it cannot be
 * mistaken for trusted serializer attributes.
 */
async function enhanceProsemirrorHtmlInternal(
  html: string,
  options: EnhancePreviewHtmlOptions = {},
  deferImages = false,
): Promise<PreparedProsemirrorPreview> {
  if (typeof document === 'undefined') {
    return { html, imageSources: new Map() }
  }

  // Deferred previews keep every source inert through async block rendering.
  // The real source is restored only after lazy-loading attributes are present.
  const preserveImageSources =
    deferImages || Boolean(options.delegateOptions?.handleViewImgSrcUrl)
  const container = document.createElement('div')
  container.innerHTML = preparePreviewHtml(html, preserveImageSources)
  restoreListOrderStyles(container)
  container.querySelectorAll('.reference-def').forEach((definition) => definition.remove())

  const htmlRenderer = createHtmlRenderer({ preserveImageSources })
  const mathRenderer = createMathRenderer({})
  const mermaidRenderer = createMermaidRenderer({})
  const specialBlockTasks = [
    ...Array.from(
      container.querySelectorAll<HTMLElement>('pre[data-type="html-block"]'),
      (block) => renderBlock(block, 'html', htmlRenderer),
    ),
    ...Array.from(
      container.querySelectorAll<HTMLElement>('[data-type="math-block"]'),
      (block) =>
        renderBlock(block, 'math', mathRenderer, block.textContent || block.dataset.tex || ''),
    ),
    ...Array.from(
      container.querySelectorAll<HTMLElement>('pre[data-type="mermaid"]'),
      (block) => renderBlock(block, 'mermaid', mermaidRenderer),
    ),
  ]

  await Promise.all(specialBlockTasks)
  renderInlineMath(container)

  const referenceDefinitions =
    options.referenceDefinitions ?? new Map<string, ReferenceDefinition>()
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'))
  const imageSources = new Map<string, string>()
  const imageTasks = deferImages
    ? []
    : images.map((image) =>
        resolveImage(image, options.delegateOptions, referenceDefinitions),
      )
  if (deferImages) {
    images.forEach((image) => {
      deferImageResolution(
        image,
        options.delegateOptions,
        referenceDefinitions,
        imageSources,
      )
    })
  }
  const codeTasks = Array.from(container.querySelectorAll<HTMLElement>('pre'))
    .filter((block) => getDirectCodeElement(block) !== null)
    .map(highlightCodeBlock)

  await Promise.all([...imageTasks, ...codeTasks])
  container
    .querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, button, select, textarea',
    )
    .forEach((control) => {
      control.disabled = true
    })

  return { html: container.innerHTML, imageSources }
}

export async function enhanceProsemirrorHtml(
  html: string,
  options: EnhancePreviewHtmlOptions = {},
): Promise<string> {
  return (await enhanceProsemirrorHtmlInternal(html, options)).html
}

export async function prepareProsemirrorPreview(
  doc: ProsemirrorNode,
  delegateOptions: DelegateOptions,
): Promise<PreparedProsemirrorPreview> {
  const html =
    typeof document === 'undefined'
      ? prosemirrorNodeToHtml(doc)
      : serializePreviewDocument(doc)
  return enhanceProsemirrorHtmlInternal(
    html,
    {
      delegateOptions,
      referenceDefinitions: collectReferenceDefinitions(doc),
    },
    true,
  )
}

export async function rmeProsemirrorNodeToHtml(
  doc: ProsemirrorNode,
  delegateOptions: DelegateOptions,
): Promise<string> {
  const html =
    typeof document === 'undefined'
      ? prosemirrorNodeToHtml(doc)
      : serializePreviewDocument(doc)
  return (
    await enhanceProsemirrorHtmlInternal(html, {
      delegateOptions,
      referenceDefinitions: collectReferenceDefinitions(doc),
    })
  ).html
}
