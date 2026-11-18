import type { IHeadingData } from '@markflowy/interface'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, type StoreApi } from 'zustand'
import { Button } from '@/components/ui/button'
import { Command } from '@/components/ui/command'
import { Popover } from '@/components/ui/popover'
import { useTranslation } from '@/i18n'
import { indexOutlineHeadings, matchOutlineHeadings } from './outlineHeadingSearch'

type HeadingStore = StoreApi<IHeadingData[]>
const PAGE_SIZE = 40

function isComposing(event: KeyboardEvent) {
  return event.isComposing || event.keyCode === 229
}

function HeadingChoices({ headings, onChoose }: {
  headings: HeadingStore
  onChoose: (heading: IHeadingData) => void
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const all = useStore(headings)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState('')
  const index = useMemo(() => indexOutlineHeadings(all), [all])
  const matches = useMemo(() => matchOutlineHeadings(index, query), [index, query])
  const pages = Math.ceil(matches.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(0, pages - 1))
  const start = currentPage * PAGE_SIZE
  const rows = matches.slice(start, start + PAGE_SIZE)
  const current = rows.some(({ heading }) => heading.id === selected)
    ? selected : rows[0]?.heading.id ?? ''
  const label = t('sidebar.outline_find_heading')
  const moveToPage = (next: number) => {
    setPage(next)
    setSelected('')
    input.current?.focus()
  }

  return (
    <>
      <Command
        label={label}
        shouldFilter={false}
        loop
        value={current}
        onValueChange={setSelected}
        onKeyDownCapture={(event) => {
          // Let the IME commit its candidate without cmdk moving or selecting
          // a heading. Do not prevent the IME's native default behavior.
          if (isComposing(event.nativeEvent)) event.stopPropagation()
          else if (event.key === 'Enter' && event.repeat) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        <Command.Input
          ref={input}
          placeholder={label}
          value={query}
          onValueChange={(value) => {
            setQuery(value)
            setPage(0)
            setSelected('')
          }}
        />
        <Command.List className='max-h-[min(320px,50vh)]'>
          <Command.Empty>{t('search.search_empty')}</Command.Empty>
          {rows.map(({ heading, title, parents }) => (
            <Command.Item
              className='gap-2'
              key={heading.id}
              value={heading.id}
              onSelect={() => {
                // A refresh can publish a replacement just before React
                // commits the new rows. Never invoke the previous snapshot.
                if (headings.getState() === all) onChoose(heading)
              }}
            >
              <span aria-hidden='true' className='shrink-0 text-ui-caption text-muted-foreground'>
                H{heading.depth}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block truncate'>{title || t('file.untitled')}</span>
                {parents ? <span className='block truncate text-ui-caption text-muted-foreground'>{parents}</span> : null}
              </span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
      {pages > 1 ? (
        <div className='flex items-center gap-1 border-t border-border px-2 py-1'>
          <span aria-live='polite' className='mr-auto text-ui-caption tabular-nums text-muted-foreground'>
            {start + 1}–{start + rows.length} / {matches.length}
          </span>
          <Button aria-label={t('document_preview.previous_page')} disabled={currentPage === 0}
            onClick={() => moveToPage(currentPage - 1)} size='icon-chrome' variant='chrome'>
            <ChevronLeftIcon aria-hidden='true' />
          </Button>
          <Button aria-label={t('document_preview.next_page')} disabled={currentPage + 1 === pages}
            onClick={() => moveToPage(currentPage + 1)} size='icon-chrome' variant='chrome'>
            <ChevronRightIcon aria-hidden='true' />
          </Button>
        </div>
      ) : null}
    </>
  )
}

export function OutlineHeadingPicker({ headings, owner }: { headings: HeadingStore; owner: object }) {
  const { t } = useTranslation()
  const [openFor, setOpenFor] = useState<object | null>(null)
  const skipRestore = useRef(false)
  useEffect(() => {
    // A previous session must not spring open if its tab is revisited.
    if (openFor && openFor !== owner) {
      skipRestore.current = true
      setOpenFor(null)
    }
  }, [openFor, owner])
  const label = t('sidebar.outline_find_heading')
  return (
    <Popover.Root open={openFor === owner} onOpenChange={(open) => {
      if (open) skipRestore.current = false
      setOpenFor(open ? owner : null)
    }}>
      <Popover.Trigger asChild>
        <Button aria-label={label} title={label} size='icon-chrome' variant='chrome'>
          <SearchIcon aria-hidden='true' strokeWidth={1.75} />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        align='end'
        aria-label={label}
        className='w-[min(340px,calc(100vw-16px))] overflow-hidden p-0'
        onCloseAutoFocus={(event) => {
          if (skipRestore.current) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (isComposing(event) || event.repeat) event.preventDefault()
        }}
      >
        <HeadingChoices headings={headings} onChoose={(heading) => {
          if (!heading.onClick) return
          // A source heading focuses its editor; a visual heading only scrolls.
          // Radix preserves outside focus in the former case and returns to
          // the trigger in the latter. Do not move a visual editor's caret.
          setOpenFor(null)
          heading.onClick(heading)
        }} />
      </Popover.Content>
    </Popover.Root>
  )
}
