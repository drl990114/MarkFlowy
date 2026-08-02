import type mermaidApi from 'mermaid'

type Mermaid = typeof mermaidApi
export type MermaidExternalLayout = 'elk' | 'tidy-tree'

let mermaidPromise: Promise<Mermaid> | undefined
let elkLayoutsPromise: Promise<void> | undefined
let tidyTreeLayoutsPromise: Promise<void> | undefined
let currentTheme: 'default' | 'dark' = 'default'

const flowchartPattern = /^\s*(?:flowchart|graph)\s+(?:TB|TD|BT|LR|RL)\b/im
const subgraphPattern = /^\s*subgraph\b/im
const subgraphDirectionPattern = /^\s*direction\s+(?:TB|TD|BT|LR|RL)\s*$/im
const explicitLayoutPattern = /\blayout\b["']?\s*:\s*["']?([\w.-]+)/i
const explicitRendererPattern = /\bdefaultRenderer\b["']?\s*:\s*["']?([\w.-]+)/i
const elkFlowchartPattern = /^\s*flowchart-elk\b/im
const frontmatterPattern = /^(\uFEFF?\s*---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$))/
const elkLayoutDirective = '%%{init: {"layout": "elk"}}%%\n'

function getMermaidConfig() {
  return {
    flowchart: { htmlLabels: false },
    htmlLabels: false,
    secure: [
      'secure',
      'securityLevel',
      'startOnLoad',
      'maxTextSize',
      'suppressErrorRendering',
      'maxEdges',
      'htmlLabels',
      'flowchart',
      'themeCSS',
      'fontFamily',
      'altFontFamily',
    ],
    securityLevel: 'strict' as const,
    startOnLoad: false,
    theme: currentTheme,
  }
}

export function prepareMermaidSource(source: string): {
  externalLayout?: MermaidExternalLayout
  renderSource: string
} {
  const explicitLayout = explicitLayoutPattern.exec(source)?.[1]
  const explicitRenderer = explicitRendererPattern.exec(source)?.[1]
  if (explicitLayout || explicitRenderer) {
    const normalizedLayout = explicitLayout?.toLowerCase()
    const normalizedRenderer = explicitRenderer?.toLowerCase()
    return {
      externalLayout:
        normalizedLayout?.startsWith('elk') || normalizedRenderer === 'elk'
          ? 'elk'
          : normalizedLayout === 'tidy-tree'
            ? 'tidy-tree'
            : undefined,
      renderSource: source,
    }
  }

  if (elkFlowchartPattern.test(source)) {
    return { externalLayout: 'elk', renderSource: source }
  }

  const needsDirectionalSubgraphLayout =
    flowchartPattern.test(source) &&
    subgraphPattern.test(source) &&
    subgraphDirectionPattern.test(source)
  if (!needsDirectionalSubgraphLayout) {
    return { renderSource: source }
  }

  const frontmatter = frontmatterPattern.exec(source)?.[1]
  const renderSource = frontmatter
    ? `${frontmatter}${elkLayoutDirective}${source.slice(frontmatter.length)}`
    : `${elkLayoutDirective}${source}`

  return { externalLayout: 'elk', renderSource }
}

export function setMermaidTheme(theme: 'default' | 'dark') {
  currentTheme = theme

  mermaidPromise
    ?.then((mermaid) => {
      mermaid.initialize(getMermaidConfig())
    })
    .catch(() => {
      // The renderer will surface load/render errors when Mermaid is actually used.
    })
}

export async function loadMermaid(options: { externalLayout?: MermaidExternalLayout } = {}) {
  mermaidPromise ??= import('mermaid')
    .then((module) => {
      const mermaid = module.default
      mermaid.registerIconPacks([
        {
          name: 'lucide',
          loader: () => import('@iconify-json/lucide').then((iconModule) => iconModule.icons),
        },
        {
          name: 'logos',
          loader: () => import('@iconify-json/logos').then((iconModule) => iconModule.icons),
        },
      ])
      return mermaid
    })
    .catch((error) => {
      mermaidPromise = undefined
      throw error
    })

  const mermaid = await mermaidPromise
  if (options.externalLayout === 'elk') {
    elkLayoutsPromise ??= import('@mermaid-js/layout-elk')
      .then((module) => {
        mermaid.registerLayoutLoaders(module.default)
      })
      .catch((error) => {
        elkLayoutsPromise = undefined
        throw error
      })
    await elkLayoutsPromise
  }
  if (options.externalLayout === 'tidy-tree') {
    tidyTreeLayoutsPromise ??= import('@mermaid-js/layout-tidy-tree')
      .then((module) => {
        mermaid.registerLayoutLoaders(module.default)
      })
      .catch((error) => {
        tidyTreeLayoutsPromise = undefined
        throw error
      })
    await tidyTreeLayoutsPromise
  }
  mermaid.initialize(getMermaidConfig())

  return mermaid
}
