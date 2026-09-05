import {
  loadCapricornRuntimeFactory,
  type CapricornRuntimeFactory,
  type CapricornRuntimeOptions,
  type CapricornRuntimeSession,
} from './capricornRuntimeAdapter'

export interface CapricornExportSurface {
  element: HTMLElement
  dispose: () => void
}

/** A disposable rendering of the host's read snapshot, with every block mounted. */
export async function createCapricornExportSurface({
  source,
  markdown,
  options,
  loadRuntime = loadCapricornRuntimeFactory,
}: {
  source: HTMLElement
  markdown: string
  options: CapricornRuntimeOptions
  loadRuntime?: () => Promise<CapricornRuntimeFactory>
}): Promise<CapricornExportSurface> {
  const createRuntime = await loadRuntime()
  const element = source.ownerDocument.createElement('div')
  element.dataset.mfCapricornExport = 'true'
  element.setAttribute('aria-hidden', 'true')
  element.inert = true
  Object.assign(element.style, {
    position: 'absolute',
    left: '-100000px',
    top: '0',
    width: `${source.getBoundingClientRect().width || source.clientWidth || 800}px`,
    pointerEvents: 'none',
  })
  source.ownerDocument.body.append(element)
  let session: CapricornRuntimeSession | undefined
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const dispose = () => {
    if (disposed) return
    disposed = true
    try {
      session?.destroy()
    } finally {
      element.remove()
    }
  }
  try {
    session = createRuntime(element, {
      ...options,
      markdown,
      mode: 'preview',
      readOnly: true,
      autoFocus: false,
      copilot: false,
      commands: undefined,
      keybindingConfiguration: undefined,
      onError: undefined,
      onEditInline: undefined,
      getScrollableContainer: () => element,
      virtualize: { enable: false },
    })
    await Promise.race([
      session.waitForResources(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Export resources timed out.')), 15_000)
      }),
    ])
    return { element, dispose }
  } catch (error) {
    dispose()
    throw error
  } finally {
    clearTimeout(timer)
  }
}
