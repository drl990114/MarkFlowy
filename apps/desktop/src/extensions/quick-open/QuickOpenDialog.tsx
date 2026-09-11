import { commandRegistry } from '@/commands'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import { Button } from '@/components/ui/button'
import { Command } from '@/components/ui/command'
import { Dialog } from '@/components/ui/dialog'
import { EVENT } from '@/constants'
import { resolveFileExcludePatterns } from '@/helper/file-exclude'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorStore from '@/stores/useEditorStore'
import { FileIcon, LoaderCircleIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  checkRecentQuickOpenFiles,
  getOpenedQuickOpenFiles,
  getRecentQuickOpenFiles,
  loadQuickOpenFiles,
  mergeQuickOpenFiles,
  openQuickOpenFile,
  rankQuickOpenFiles,
  type QuickOpenFile,
} from './quickOpenFiles'

const PAGE_SIZE = 100
const MORE_RESULTS_ID = 'quick-open:more'

interface QuickOpenContentProps {
  rootPath?: string
  fileExcludePatterns: string
  inputRef: RefObject<HTMLInputElement | null>
  onSelect: (file: QuickOpenFile) => void
}

function QuickOpenContent({
  rootPath,
  fileExcludePatterns,
  inputRef,
  onSelect,
}: QuickOpenContentProps) {
  const { t } = useTranslation()
  const [historyFiles] = useState(() => getRecentQuickOpenFiles(rootPath))
  const [openedFiles, setOpenedFiles] = useState(() => getOpenedQuickOpenFiles(rootPath))
  const [workspaceFiles, setWorkspaceFiles] = useState<QuickOpenFile[]>([])
  const [unavailableIds, setUnavailableIds] = useState<ReadonlySet<string>>(() => new Set())
  const [scanRequested, setScanRequested] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const listRef = useRef<HTMLDivElement>(null)
  const manualSelection = useRef(false)
  const searching = query.trim().length > 0

  useEffect(() => {
    const controller = new AbortController()
    void checkRecentQuickOpenFiles(historyFiles, controller.signal, (id) => {
      setUnavailableIds((ids) => new Set([...ids, id]))
    })
    return () => controller.abort()
  }, [historyFiles])

  useEffect(() => {
    if (!rootPath || !scanRequested) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    loadQuickOpenFiles(rootPath, fileExcludePatterns).then(
      (files) => {
        if (cancelled) return
        setOpenedFiles(getOpenedQuickOpenFiles(rootPath))
        setWorkspaceFiles(files)
        setLoading(false)
      },
      (error: unknown) => {
        if (cancelled) return
        logger.error('Failed to load Quick Open files', error)
        setFailed(true)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [rootPath, fileExcludePatterns, retry, scanRequested])

  const files = useMemo(
    () => mergeQuickOpenFiles(openedFiles, historyFiles, workspaceFiles),
    [openedFiles, historyFiles, workspaceFiles],
  )
  const matches = useMemo(() => {
    const candidates = searching
      ? rankQuickOpenFiles(
          files,
          query,
          historyFiles.map((file) => file.id),
        )
      : historyFiles
    const openedIds = new Set(openedFiles.map((file) => file.id))
    return candidates.filter((file) => !unavailableIds.has(file.id) || openedIds.has(file.id))
  }, [files, query, searching, historyFiles, openedFiles, unavailableIds])
  const selectedIndex = matches.findIndex((file) => file.id === selectedId)
  // A manually selected result may move past the current page after the scan.
  const renderedCount = Math.max(
    visibleCount,
    Math.ceil((selectedIndex + 1) / PAGE_SIZE) * PAGE_SIZE,
  )
  const visibleFiles = matches.slice(0, renderedCount)
  const hasMore = matches.length > renderedCount
  const value =
    visibleFiles.some((file) => file.id === selectedId) ||
    (hasMore && selectedId === MORE_RESULTS_ID)
      ? selectedId
      : (visibleFiles[0]?.id ?? '')

  const previousMatches = useRef(matches)
  useEffect(() => {
    // cmdk owns ordinary keyboard/pointer scrolling. Follow the selected file
    // here only when asynchronous results move it in the list.
    if (previousMatches.current !== matches && selectedId) {
      listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
    }
    previousMatches.current = matches
  }, [matches, selectedId])

  return (
    <Command
      label={t('quick_open.title')}
      value={value}
      onValueChange={(id) => {
        if (manualSelection.current) setSelectedId(id)
      }}
      onKeyDownCapture={(event) => {
        if (
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229 &&
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
        ) {
          manualSelection.current = true
          setSelectedId(value)
        }
      }}
      shouldFilter={false}
      vimBindings={false}
    >
      <Command.Input
        aria-label={t('quick_open.title')}
        className='h-11'
        wrapperClassName='pr-11'
        placeholder={t('quick_open.placeholder')}
        ref={inputRef}
        value={query}
        onValueChange={(nextQuery) => {
          setQuery(nextQuery)
          if (nextQuery.trim()) setScanRequested(true)
          manualSelection.current = false
          setSelectedId('')
          setVisibleCount(PAGE_SIZE)
          listRef.current?.scrollTo({ top: 0 })
        }}
      />
      <Command.List
        label={t('quick_open.title')}
        aria-busy={searching && loading}
        className='max-h-[min(50vh,24rem)]'
        ref={listRef}
      >
        {searching && loading ? (
          <div
            className='flex items-center gap-2 px-2 py-2 text-ui-caption text-muted-foreground'
            role='status'
          >
            <LoaderCircleIcon
              aria-hidden='true'
              className='size-3.5 animate-spin motion-reduce:animate-none'
            />
            {t('quick_open.loading')}
          </div>
        ) : null}
        {searching && failed ? (
          <div
            className='flex items-center justify-between gap-2 px-2 py-2 text-ui-caption'
            role='alert'
          >
            <span>{t('quick_open.load_error')}</span>
            <Button
              variant='ghost'
              size='sm'
              onKeyDown={(event) => {
                // Let the button activate without cmdk opening the selected file.
                if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
              }}
              onClick={() => {
                setRetry((attempt) => attempt + 1)
                inputRef.current?.focus()
              }}
            >
              {t('bookmarks.retry')}
            </Button>
          </div>
        ) : null}
        {!(searching && (loading || failed)) && matches.length === 0 ? (
          <Command.Empty>
            {!searching && rootPath
              ? t('quick_open.no_recent')
              : rootPath || openedFiles.length
                ? t('quick_open.empty')
                : t('quick_open.no_workspace')}
          </Command.Empty>
        ) : null}
        {visibleFiles.map((file) => (
          <Command.Item
            key={file.id}
            value={file.id}
            onPointerMoveCapture={() => {
              manualSelection.current = true
              setSelectedId(file.id)
            }}
            onSelect={() => onSelect(file)}
            title={file.path ?? file.name}
          >
            <FileIcon aria-hidden='true' className='size-3.5 shrink-0 text-muted-foreground' />
            <span className='min-w-0 shrink truncate'>{file.name}</span>
            <span className='ml-auto min-w-0 max-w-[60%] truncate text-ui-caption text-muted-foreground'>
              {file.relativePath === file.name ? '' : file.relativePath}
            </span>
          </Command.Item>
        ))}
        {matches.length > PAGE_SIZE ? (
          // Keep the paging item mounted so cmdk does not reset selection to
          // the first file when the final page replaces the selected action.
          <Command.Item
            className={hasMore ? undefined : 'hidden'}
            disabled={!hasMore}
            hidden={!hasMore}
            value={MORE_RESULTS_ID}
            onPointerMoveCapture={() => {
              manualSelection.current = true
              setSelectedId(MORE_RESULTS_ID)
            }}
            onSelect={() => {
              manualSelection.current = true
              setSelectedId(matches[renderedCount].id)
              setVisibleCount(renderedCount + PAGE_SIZE)
            }}
          >
            {t('quick_open.show_more', { count: Math.max(0, matches.length - renderedCount) })}
          </Command.Item>
        ) : null}
      </Command.List>
      <div className='border-t border-border px-3 py-2 text-ui-caption text-muted-foreground'>
        {t('quick_open.keyboard_hint')}
      </div>
    </Command>
  )
}

export function QuickOpenDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const openedFileRef = useRef(false)
  const rootPath = useEditorStore((state) => state.folderData?.[0]?.path)
  const fileExcludePatterns = useAppSettingStore((state) =>
    resolveFileExcludePatterns(state.settingData),
  )

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: EVENT.app_quickOpen,
      label: t('quick_open.title'),
      category: 'File',
      handler: () => {
        setOpen(true)
        inputRef.current?.focus()
        inputRef.current?.select()
      },
    })
    return () => disposable.dispose()
  }, [t])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Content
        className='top-[min(18vh,8rem)] translate-y-0 gap-0 p-0'
        closeLabel={t('common.close')}
        data-mf-quick-open=''
        onCloseAutoFocus={(event) => {
          if (!openedFileRef.current) return
          openedFileRef.current = false
          event.preventDefault()
          scheduleActiveEditorFocus()
        }}
        onEscapeKeyDown={(event) => {
          if (event.isComposing || event.keyCode === 229) event.preventDefault()
        }}
      >
        <Dialog.Title className='sr-only'>{t('quick_open.title')}</Dialog.Title>
        <Dialog.Description className='sr-only'>{t('quick_open.placeholder')}</Dialog.Description>
        {open ? (
          <QuickOpenContent
            key={`${rootPath ?? ''}\n${fileExcludePatterns}`}
            rootPath={rootPath}
            fileExcludePatterns={fileExcludePatterns}
            inputRef={inputRef}
            onSelect={(entry) => {
              if (!openQuickOpenFile(entry)) return
              openedFileRef.current = true
              setOpen(false)
            }}
          />
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  )
}
