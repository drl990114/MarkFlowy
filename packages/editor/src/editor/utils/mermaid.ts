import type mermaidApi from 'mermaid'

type Mermaid = typeof mermaidApi

let mermaidPromise: Promise<Mermaid> | undefined
let currentTheme: 'default' | 'dark' = 'default'

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

export function setMermaidTheme(theme: 'default' | 'dark') {
  currentTheme = theme

  mermaidPromise?.then((mermaid) => {
    mermaid.initialize(getMermaidConfig())
  }).catch(() => {
    // The renderer will surface load/render errors when Mermaid is actually used.
  })
}

export async function loadMermaid() {
  mermaidPromise ??= import('mermaid')
    .then((module) => module.default)
    .catch((error) => {
      mermaidPromise = undefined
      throw error
    })

  const mermaid = await mermaidPromise
  mermaid.initialize(getMermaidConfig())

  return mermaid
}
