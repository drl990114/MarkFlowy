import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import { ThemeProvider } from 'styled-components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PopoverRoot, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { capricornStyle, desktopVariables, legacyTokens } from '@/themes/runtime'
import {
  createCapricornRuntimeAdapter,
  loadCapricornRuntimeFactory,
  type CapricornRuntimeAdapter,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import type { ResolvedTheme, ThemeTokenName } from '@markflowy/theme/semantic'
import type { ThemePreviewState, ThemePreviewLabels } from './protocol'
const markdown =
  '# A quieter place to write\n\nMake room for **ideas**, *details*, and [connections](https://markflowy.com).\n\n> A theme should support the words.\n\n- First thought\n- Another possibility\n\n| Detail | Value |\n| --- | --- |\n| Theme | Personal |\n\n```typescript\n// Keep your ideas close\nconst message = "Hello, MarkFlowy"\nfunction greet(name: string) { return `${message}, ${name}` }\n```\n'
const inspectSelectors: [string, ThemeTokenName][] = [
  ...(
    [
      'comment',
      'keyword',
      'string',
      'number',
      'variable',
      'attribute',
      'tag',
      'punctuation',
      'meta',
    ] as const
  ).map((name) => [`.cap-syntax-${name}`, `syntax.${name}`] as [string, ThemeTokenName]),
  ['.cap-syntax-title', 'syntax.function'],
  ['.cm-editor', 'editor.code.background'],
  ['a', 'editor.link'],
  ['[data-cap-caret]', 'editor.caret'],
  ['[data-cap-overlay]', 'surface.overlay'],
  ['[data-cap-content]', 'editor.background'],
  ['[data-theme-token]', 'surface.canvas'],
]

export function PreviewSurface({
  theme,
  snippets,
  inspect,
  labels,
  onInspect,
}: ThemePreviewState & { onInspect: (name: ThemeTokenName) => void }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-mf-theme', theme.mode)
    document.documentElement.style.colorScheme = theme.mode
  }, [theme.mode])
  const variables = desktopVariables(theme.tokens)
  const baseCss = `:root{${Object.entries(variables)
    .map(([key, value]) => `${key}:${value};`)
    .join(
      '',
    )}}body{margin:0;background:var(--mf-background);color:var(--mf-foreground);font:var(--mf-ui-font-control) / var(--mf-ui-line-height-control) var(--mf-ui-font-family)}*{box-sizing:border-box}`
  const handleInspect = (event: MouseEvent) => {
    if (!inspect && event.type !== 'contextmenu') return
    event.preventDefault()
    event.stopPropagation()
    const target = event.target as HTMLElement
    const match = inspectSelectors.find(([selector]) => target.closest(selector))
    if (match) {
      const element = target.closest(match[0]) as HTMLElement
      element.animate?.(
        [{ outline: '2px solid var(--mf-ring)' }, { outline: '2px solid transparent' }],
        { duration: 800 },
      )
      onInspect((element.dataset.themeToken || match[1]) as ThemeTokenName)
    }
  }
  return (
    <ThemeProvider theme={legacyTokens(theme.tokens, theme.mode)}>
      <style>{baseCss}</style>
      <div onClickCapture={inspect ? handleInspect : undefined} onContextMenu={handleInspect}>
        <header
          data-theme-token='chrome.titlebar.background'
          style={{ background: 'var(--mf-theme-chrome-titlebar-background)' }}
          className='flex items-center justify-between border-b border-border p-3'
        >
          <strong>MarkFlowy</strong>
          <PopoverRoot>
            <PopoverTrigger asChild>
              <Button size='sm' variant='outline'>
                Aa
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <span data-theme-token='text.secondary'>{labels.preview}</span>
            </PopoverContent>
          </PopoverRoot>
        </header>
        <div className='flex min-h-[440px]'>
          <aside
            data-theme-token='chrome.sidebar.background'
            className='w-32 shrink-0 space-y-3 border-r border-border p-3'
            style={{ background: 'var(--mf-theme-chrome-sidebar-background)' }}
          >
            <strong>Notes</strong>
            <p
              data-theme-token='text.secondary'
              style={{ color: 'var(--mf-theme-text-secondary)' }}
            >
              Ideas
            </p>
            <p
              data-theme-token='interaction.selected'
              style={{ background: 'var(--mf-theme-interaction-selected)' }}
            >
              Welcome
            </p>
            <Input aria-label='Search preview' placeholder='Search…' />
            <Button data-theme-token='accent.background' size='sm'>
              New note
            </Button>
          </aside>
          <PreviewEditor theme={theme} labels={labels} />
        </div>
      </div>
      <style>{theme.css}</style>
      {snippets.map((snippet) => (
        <style key={snippet.id} data-mf-css-snippet=''>
          {snippet.css}
        </style>
      ))}
    </ThemeProvider>
  )
}

function PreviewEditor({ theme, labels }: { theme: ResolvedTheme; labels: ThemePreviewLabels }) {
  const container = useRef<HTMLDivElement>(null)
  const adapter = useRef<CapricornRuntimeAdapter | null>(null)
  const latest = useRef(theme)
  latest.current = theme
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setError('')
    void loadCapricornRuntimeFactory()
      .then((createRuntime) => {
        if (cancelled || !container.current) return
        const current = latest.current
        adapter.current = createCapricornRuntimeAdapter({
          container: container.current,
          createRuntime,
          onChange: () => undefined,
          options: {
            markdown,
            handleLinkClick: () => undefined,
            colorScheme: current.mode,
            style: capricornStyle(current.tokens, 'document') as CSSProperties,
            onError: (cause) => setError(String(cause)),
          },
        })
      })
      .catch((cause) => {
        if (!cancelled) setError(String(cause))
      })
    return () => {
      cancelled = true
      adapter.current?.destroy()
      adapter.current = null
    }
  }, [attempt])
  useEffect(() => {
    adapter.current?.updateSettings({
      colorScheme: theme.mode,
      style: capricornStyle(theme.tokens, 'document') as CSSProperties,
    })
  }, [theme])
  return (
    <main className='min-w-0 flex-1'>
      {error && (
        <div role='alert' className='p-3 text-destructive'>
          {labels.loadError}
          <details>
            <summary>{labels.error}</summary>
            {error}
          </details>
          <Button variant='outline' onClick={() => setAttempt((value) => value + 1)}>
            {labels.retry}
          </Button>
        </div>
      )}
      <div
        ref={container}
        className='h-[560px] overflow-auto'
        data-theme-token='editor.background'
      />
    </main>
  )
}
