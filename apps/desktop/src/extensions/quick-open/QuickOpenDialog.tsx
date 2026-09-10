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
  getOpenedQuickOpenFiles,
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
  const [openedFiles] = useState(() => getOpenedQuickOpenFiles(rootPath))
  const [workspaceFiles, setWorkspaceFiles] = useState<QuickOpenFile[]>([])
  const [loading, setLoading] = useState(Boolean(rootPath))
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rootPath) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    loadQuickOpenFiles(rootPath, fileExcludePatterns).then(
      (files) => {
        if (cancelled) return
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
  }, [rootPath, fileExcludePatterns, retry])

  const files = useMemo(
    () => mergeQuickOpenFiles(openedFiles, workspaceFiles),
    [openedFiles, workspaceFiles],
  )
  const matches = useMemo(() => rankQuickOpenFiles(files, query), [files, query])
  const visibleFiles = matches.slice(0, visibleCount)
  const hasMore = matches.length > visibleCount
  const value =
    visibleFiles.some((file) => file.id === selectedId) ||
    (hasMore && selectedId === MORE_RESULTS_ID)
      ? selectedId
      : (visibleFiles[0]?.id ?? '')

  return (
    <Command
      label={t('quick_open.title')}
      value={value}
      onValueChange={setSelectedId}
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
          setSelectedId('')
          setVisibleCount(PAGE_SIZE)
          listRef.current?.scrollTo({ top: 0 })
        }}
      />
      <Command.List
        label={t('quick_open.title')}
        aria-busy={loading}
        className='max-h-[min(50vh,24rem)]'
        ref={listRef}
      >
        {loading ? (
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
        {failed ? (
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
        {!loading && !failed && matches.length === 0 ? (
          <Command.Empty>
            {rootPath || openedFiles.length ? t('quick_open.empty') : t('quick_open.no_workspace')}
          </Command.Empty>
        ) : null}
        {visibleFiles.map((file) => (
          <Command.Item
            key={file.id}
            value={file.id}
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
            onSelect={() => {
              setSelectedId(matches[visibleCount].id)
              setVisibleCount((count) => count + PAGE_SIZE)
            }}
          >
            {t('quick_open.show_more', { count: Math.max(0, matches.length - visibleCount) })}
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
