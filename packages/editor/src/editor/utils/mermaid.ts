type Mermaid = typeof import('mermaid')['default']

let mermaidPromise: Promise<Mermaid> | undefined
let currentTheme: 'default' | 'dark' = 'default'

export function setMermaidTheme(theme: 'default' | 'dark') {
  currentTheme = theme

  mermaidPromise?.then((mermaid) => {
    mermaid.initialize({ theme })
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
  mermaid.initialize({ theme: currentTheme })

  return mermaid
}
