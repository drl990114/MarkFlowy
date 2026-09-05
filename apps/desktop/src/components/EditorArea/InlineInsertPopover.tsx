import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CopyIcon, ExternalLinkIcon, FolderOpenIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover } from '@/components/ui/popover'
import { useTranslation } from '@/i18n'
import type { CapricornInlineEditRequest, CapricornRuntimeAdapter } from './capricornRuntimeAdapter'
import { chooseInlineImage, formatInlineAddress, normalizeInlineAddress } from './inlineInsert'

export function InlineInsertPopover({
  editor,
  editorId,
  active,
  anchorElement,
}: {
  editor: CapricornRuntimeAdapter | null
  editorId?: string
  active: boolean
  anchorElement?: HTMLElement
}) {
  const { t } = useTranslation()
  const id = useId()
  const [request, setRequest] = useState<CapricornInlineEditRequest | null>(null)
  const requestRef = useRef(request)
  const ownerRef = useRef(editor)
  const [address, setAddress] = useState('')
  const [text, setText] = useState('')
  const [localPath, setLocalPath] = useState<string | null>(null)
  const [editing, setEditing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectingRef = useRef(false)
  const busyRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const close = (restore = false) => {
    const current = requestRef.current
    requestRef.current = null
    selectingRef.current = false
    busyRef.current = false
    if (current && restore && editor?.selection?.restore(current.bookmark.id)) editor.focus()
    if (current) editor?.selection?.release(current.bookmark.id)
    setRequest(null)
  }

  useEffect(() => {
    if (!active || !editor) return
    return editor.subscribeInlineEdit?.((next) => {
      if (!next) {
        requestRef.current = null
        setRequest(null)
        return
      }
      ownerRef.current = editor
      requestRef.current = next
      setRequest(next)
      setAddress(
        formatInlineAddress(
          next.kind === 'link'
            ? (next.bookmark.link?.href ?? '')
            : (next.bookmark.image?.src ?? ''),
        ),
      )
      setText(next.kind === 'image' ? (next.bookmark.image?.alt ?? next.bookmark.text) : '')
      setLocalPath(null)
      setEditing(next.focus || next.kind === 'link' || !next.bookmark.image)
      setError('')
      setBusy(false)
      busyRef.current = false
      selectingRef.current = false
    })
  }, [active, editor])

  useEffect(() => {
    if (active && ownerRef.current === editor) return
    const current = requestRef.current
    requestRef.current = null
    if (current) ownerRef.current?.selection?.release(current.bookmark.id)
    ownerRef.current = editor
    setRequest(null)
  }, [active, editor])

  useEffect(() => {
    if (!editor || !request) return
    const dismissInvalid = () => {
      if (editor.selection?.isValid(request.bookmark.id)) return
      requestRef.current = null
      setRequest(null)
    }
    const unsubscribe = editor.subscribeUiState(dismissInvalid)
    return () => {
      unsubscribe()
      editor.selection?.release(request.bookmark.id)
    }
  }, [editor, request])

  const anchor = useMemo(
    () => ({
      current: {
        contextElement: anchorElement,
        getBoundingClientRect: () => {
          const rect = request && editor?.selection?.getRect(request.bookmark.id)
          return rect ? new DOMRect(rect.x, rect.y, rect.width, rect.height) : new DOMRect()
        },
      },
    }),
    [anchorElement, editor, request],
  )

  if (!request || !active || !editor?.selection || ownerRef.current !== editor) return null
  const selection = editor.selection
  const bookmark = request.bookmark
  const image = request.kind === 'image'
  const existing = image ? bookmark.image : bookmark.link
  const validTarget = () =>
    ownerRef.current === editor && requestRef.current === request && selection.isValid(bookmark.id)
  const canEdit =
    bookmark.canInsertInline &&
    (image
      ? Boolean(!existing || editor.commands.updateImage)
      : Boolean(editor.commands.insertLink && (!existing || editor.commands.updateLink)))

  const chooseFile = async () => {
    if (busyRef.current) return
    busyRef.current = true
    selectingRef.current = true
    setBusy(true)
    setError('')
    try {
      const path = await chooseInlineImage()
      if (!path || !validTarget()) return
      setLocalPath(path)
      setAddress('')
      if (!text) setText((path.split(/[\\/]/).pop() ?? '').replace(/\.[^.]+$/, ''))
    } catch {
      if (validTarget()) setError(t('inline_insert.local_error'))
    } finally {
      if (requestRef.current === request) {
        selectingRef.current = false
        busyRef.current = false
        if (validTarget()) {
          setBusy(false)
          inputRef.current?.focus()
        }
      }
    }
  }

  const submit = async () => {
    if (busyRef.current || !canEdit || !validTarget()) return
    const originalAddress = image ? bookmark.image?.src : bookmark.link?.href
    const sourceAddress =
      originalAddress && address === formatInlineAddress(originalAddress)
        ? originalAddress
        : address
    const normalized = localPath ? null : normalizeInlineAddress(sourceAddress, request.kind)
    if (!localPath && !normalized) {
      setError(t('inline_insert.invalid_address'))
      inputRef.current?.focus()
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const attributes = image
        ? {
            ...(localPath
              ? await (
                  await import('./imageHandlers')
                ).handleInsertLocalImage(localPath, editorId, { throwOnError: true })
              : { src: normalized! }),
            alt: text,
          }
        : null
      if (!validTarget() || !selection.restore(bookmark.id)) return
      if (attributes) {
        if (bookmark.image) editor.commands.updateImage?.(bookmark.image.key, attributes)
        else editor.commands.insertImage(attributes)
      } else if (bookmark.link) editor.commands.updateLink?.({ href: normalized! })
      else
        editor.commands.insertLink?.({
          href: normalized!,
          ...(bookmark.isCollapsed ? { text: text || normalized! } : {}),
        })
      close()
      editor.focus()
    } catch {
      if (validTarget()) setError(t('inline_insert.insert_error'))
    } finally {
      if (requestRef.current === request) {
        busyRef.current = false
        if (validTarget()) setBusy(false)
      }
    }
  }

  const remove = () => {
    if (busyRef.current || !validTarget() || !selection.restore(bookmark.id)) return
    if (image && bookmark.image) editor.commands.removeImage?.(bookmark.image.key)
    else editor.commands.removeLink?.()
    close()
    editor.focus()
  }

  const title = t(
    image
      ? existing
        ? 'inline_insert.edit_image'
        : 'inline_insert.insert_image'
      : existing
        ? 'inline_insert.edit_link'
        : 'inline_insert.insert_link',
  )

  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open && !selectingRef.current) close()
      }}
    >
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Content
        align='start'
        sideOffset={6}
        collisionPadding={8}
        aria-label={title}
        className='w-80 max-w-[calc(100vw-16px)] p-3'
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (request.focus) inputRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => close(true)}
        onInteractOutside={(event) => {
          if (selectingRef.current) event.preventDefault()
        }}
        onFocusOutside={(event) => {
          // Inspecting a clicked link/image leaves focus in the editor.
          if (selectingRef.current || !request.focus) event.preventDefault()
        }}
      >
        {image && existing && !editing ? (
          <div className='flex items-center gap-1' role='toolbar' aria-label={title}>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => {
                setEditing(true)
                queueMicrotask(() => inputRef.current?.focus())
              }}
            >
              {t('inline_insert.replace_image')}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => {
                setEditing(true)
                queueMicrotask(() => document.getElementById(`${id}-text`)?.focus())
              }}
            >
              {t('inline_insert.edit_alt')}
            </Button>
            <Button size='sm' variant='ghost' onClick={remove}>
              {t('inline_insert.remove')}
            </Button>
          </div>
        ) : (
          <form
            className='flex flex-col gap-3'
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
                event.preventDefault()
            }}
          >
            <div className='flex items-center justify-between gap-2'>
              <span className='font-medium'>{title}</span>
              <Button
                size='icon-chrome'
                variant='chrome'
                aria-label={t('inline_insert.close')}
                onClick={() => close(true)}
              >
                <XIcon aria-hidden size={14} />
              </Button>
            </div>
            <div className='flex flex-col gap-1.5'>
              <label htmlFor={`${id}-address`}>{t('inline_insert.address')}</label>
              {localPath ? (
                <div className='flex items-center gap-2'>
                  <span className='min-w-0 flex-1 truncate' title={localPath}>
                    {localPath.split(/[\\/]/).pop()}
                  </span>
                  <Button
                    size='sm'
                    variant='ghost'
                    disabled={busy}
                    onClick={() => {
                      setLocalPath(null)
                      setAddress('')
                    }}
                  >
                    {t('inline_insert.change')}
                  </Button>
                </div>
              ) : (
                <Input
                  id={`${id}-address`}
                  ref={inputRef}
                  value={address}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                  disabled={busy}
                  placeholder={image ? 'https://… / ./assets/image.png' : 'https://example.com'}
                  onChange={(event) => {
                    setAddress(event.target.value)
                    setError('')
                  }}
                />
              )}
              {image ? (
                <Button
                  variant='outline'
                  size='sm'
                  disabled={busy || !canEdit}
                  onClick={() => void chooseFile()}
                >
                  <FolderOpenIcon aria-hidden size={14} />
                  {t('inline_insert.choose_image')}
                </Button>
              ) : null}
            </div>
            {image || (bookmark.isCollapsed && !bookmark.link) ? (
              <div className='flex flex-col gap-1.5'>
                <label htmlFor={`${id}-text`}>
                  {t(image ? 'inline_insert.alt' : 'inline_insert.text')}
                </label>
                <Input
                  id={`${id}-text`}
                  value={text}
                  disabled={busy}
                  placeholder={t('inline_insert.optional')}
                  onChange={(event) => setText(event.target.value)}
                />
              </div>
            ) : null}
            {!canEdit ? (
              <p className='text-xs text-content-secondary'>{t('inline_insert.single_block')}</p>
            ) : null}
            {error ? (
              <p id={`${id}-error`} role='alert' className='text-xs text-destructive'>
                {error}
              </p>
            ) : null}
            <div className='flex items-center gap-1'>
              {!image && bookmark.link ? (
                <>
                  <Button
                    size='icon-sm'
                    variant='ghost'
                    aria-label={t('inline_insert.open')}
                    onClick={() => {
                      void import('./openEditorLink')
                        .then(({ openEditorLink }) => openEditorLink(bookmark.link!.href, editorId))
                        .then((opened) => {
                          if (!opened && validTarget()) setError(t('inline_insert.open_error'))
                        })
                        .catch(() => {
                          if (validTarget()) setError(t('inline_insert.open_error'))
                        })
                    }}
                  >
                    <ExternalLinkIcon aria-hidden size={14} />
                  </Button>
                  <Button
                    size='icon-sm'
                    variant='ghost'
                    aria-label={t('inline_insert.copy')}
                    onClick={() => {
                      void import('@tauri-apps/plugin-clipboard-manager')
                        .then(({ writeText }) => writeText(bookmark.link!.href))
                        .catch(() => {
                          if (validTarget()) setError(t('inline_insert.copy_error'))
                        })
                    }}
                  >
                    <CopyIcon aria-hidden size={14} />
                  </Button>
                </>
              ) : null}
              {existing ? (
                <Button size='sm' variant='ghost' disabled={busy} onClick={remove}>
                  {t(image ? 'inline_insert.remove' : 'inline_insert.unlink')}
                </Button>
              ) : null}
              <Button
                className='ml-auto'
                size='sm'
                type='submit'
                disabled={busy || !canEdit || (!localPath && !address.trim())}
              >
                {t(
                  busy
                    ? 'inline_insert.inserting'
                    : existing
                      ? 'inline_insert.save'
                      : 'inline_insert.insert',
                )}
              </Button>
            </div>
          </form>
        )}
      </Popover.Content>
    </Popover.Root>
  )
}
