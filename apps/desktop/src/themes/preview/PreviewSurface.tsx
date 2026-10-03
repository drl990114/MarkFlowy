import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import { ThemeProvider } from 'styled-components'
import {
  BookmarkIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  FilesIcon,
  FolderOpenIcon,
  ListIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'
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
  '# A place for ideas\n\nMake room for **ideas**, *details*, and [connections](https://markflowy.com).\n\n> A theme should support the words.\n\n## A little structure\n\n- First thought\n- Another possibility\n\n```typescript\n// Keep your ideas close\nconst message = "Hello, MarkFlowy"\nfunction greet(name: string) {\n  return `${message}, ${name}`\n}\n```\n\n| Detail | Value |\n| --- | --- |\n| Theme | Personal |\n'
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [search, setSearch] = useState('')
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-mf-theme', theme.mode)
    document.documentElement.style.colorScheme = theme.mode
  }, [theme.mode])
  const variables = desktopVariables(theme.tokens)
  const baseCss = `:root{${Object.entries(variables)
    .map(([key, value]) => `${key}:${value};`)
    .join('')}}`
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
      <div
        className='mf-theme-preview @container/preview flex h-full min-h-0 flex-col overflow-hidden'
        data-slot='theme-preview-workspace'
        onClickCapture={inspect ? handleInspect : undefined}
        onContextMenu={handleInspect}
      >
        <header
          data-theme-token='chrome.titlebar.background'
          data-slot='title-bar'
          className='flex h-[var(--mf-ui-title-bar-height)] shrink-0 items-center justify-between border-b border-border bg-surface-titlebar px-2 text-muted-foreground'
        >
          <Button
            size='icon-chrome'
            variant='chrome'
            aria-label={labels.previewNotes}
            aria-pressed={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <FolderOpenIcon aria-hidden />
          </Button>
          <span className='text-ui-caption' data-theme-token='text.secondary'>
            MarkFlowy
          </span>
          <ChevronDownIcon className='size-3.5' aria-hidden />
        </header>
        <div className='flex min-h-0 flex-1'>
          {sidebarOpen && (
            <aside
              data-theme-token='chrome.sidebar.background'
              aria-label={labels.previewNotes}
              className='w-32 shrink-0 overflow-hidden border-r border-border bg-surface-panel-left @min-[36rem]/preview:w-40'
            >
              <div className='flex h-8 items-center justify-between px-2 text-ui-caption text-muted-foreground'>
                <span data-theme-token='text.secondary'>{labels.previewNotes}</span>
                <ChevronsUpDownIcon className='size-3' aria-hidden />
              </div>
              <div className='flex h-7 items-center gap-1.5 px-2'>
                <ChevronDownIcon className='size-3 shrink-0 text-muted-foreground' aria-hidden />
                <FolderOpenIcon className='size-3.5 shrink-0 text-muted-foreground' aria-hidden />
                <span className='truncate'>{labels.previewNotes}</span>
              </div>
              <div className='space-y-0.5 px-1'>
                {[labels.previewWelcome, labels.previewIdeas]
                  .filter((name) => name.toLowerCase().includes(search.toLowerCase()))
                  .map((name) => (
                    <div
                      key={name}
                      data-theme-token={
                        name === labels.previewWelcome ? 'interaction.selected' : 'text.secondary'
                      }
                      aria-current={name === labels.previewWelcome ? 'page' : undefined}
                      className='flex h-7 items-center gap-1.5 rounded-sm pr-2 pl-6 text-ui-control'
                      style={
                        name === labels.previewWelcome
                          ? { background: 'var(--mf-theme-interaction-selected)' }
                          : { color: 'var(--mf-theme-text-secondary)' }
                      }
                    >
                      <FileTextIcon
                        className='size-3.5 shrink-0 text-muted-foreground'
                        aria-hidden
                      />
                      <span className='truncate'>{name}.md</span>
                    </div>
                  ))}
              </div>
            </aside>
          )}
          <div className='flex min-w-0 flex-1 flex-col'>
            <div
              data-theme-token='chrome.tab.background'
              className='flex h-8 shrink-0 overflow-hidden border-b border-border'
              style={{ background: 'var(--mf-theme-chrome-tab-background)' }}
            >
              <div
                data-theme-token='chrome.tab.activeBackground'
                className='flex min-w-0 items-center gap-2 border-r border-border px-3 text-ui-control font-medium'
                style={{ background: 'var(--mf-theme-chrome-tab-active-background)' }}
              >
                <FileTextIcon className='size-3.5 shrink-0 text-muted-foreground' aria-hidden />
                <span className='truncate'>{labels.previewWelcome}.md</span>
                <XIcon className='size-3 shrink-0 text-muted-foreground' aria-hidden />
              </div>
              <div className='hidden min-w-0 items-center gap-2 border-r border-border px-3 text-ui-control text-muted-foreground @min-[32rem]/preview:flex'>
                <span className='truncate'>{labels.previewIdeas}.md</span>
              </div>
            </div>
            <PreviewEditor theme={theme} labels={labels} />
          </div>
        </div>
        <footer
          data-theme-token='chrome.statusbar.background'
          className='flex h-[var(--mf-ui-status-bar-height)] shrink-0 items-center justify-between border-t border-border bg-surface-statusbar px-1.5 text-ui-caption text-muted-foreground'
        >
          <div className='flex items-center gap-1'>
            <Button
              data-theme-token='accent.background'
              size='icon-chrome'
              variant='chrome'
              aria-label={labels.previewNotes}
              aria-pressed={sidebarOpen}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FilesIcon aria-hidden />
            </Button>
            <PopoverRoot>
              <PopoverTrigger asChild>
                <Button size='icon-chrome' variant='chrome' aria-label={labels.previewSearch}>
                  <SearchIcon aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side='top'
                align='start'
                aria-label={labels.previewSearch}
                className='w-52'
              >
                <Input
                  inputSize='sm'
                  aria-label={labels.previewSearch}
                  placeholder={labels.previewSearchPlaceholder}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setSidebarOpen(true)
                  }}
                />
              </PopoverContent>
            </PopoverRoot>
            <BookmarkIcon className='mx-1 size-3.5' aria-hidden />
          </div>
          <div className='flex items-center gap-3 px-1' data-theme-token='text.secondary'>
            <span>Markdown</span>
            <ListIcon className='size-3.5' aria-hidden />
          </div>
        </footer>
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
    <main
      className='flex min-h-0 min-w-0 flex-1 flex-col'
      style={{ background: 'var(--mf-theme-editor-background)' }}
    >
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
        className='min-h-0 flex-1 overflow-auto'
        data-theme-token='editor.background'
      />
    </main>
  )
}
