import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpenIcon, LinkIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'

export const MODAL_IMAGE_INSERT_ID = 'modal-image-insert'

export type ImageInsertSelection =
  | {
      type: 'url'
      url: string
    }
  | {
      type: 'local'
      path: string
    }

export const isSupportedImageUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function ImageInsertModal() {
  const modal = useModal()
  const { t } = useTranslation()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const settledRef = useRef(false)
  const finalizedRef = useRef(false)
  const resultRef = useRef<ImageInsertSelection | null>(null)
  const [openState, setOpenState] = useState(modal.visible)
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [localError, setLocalError] = useState(false)

  useEffect(() => {
    if (!modal.visible) return
    settledRef.current = false
    finalizedRef.current = false
    resultRef.current = null
    setUrl('')
    setUrlError(false)
    setIsSelecting(false)
    setLocalError(false)
    setOpenState(true)
  }, [modal.visible])

  const startClose = (result: ImageInsertSelection | null) => {
    if (settledRef.current) return
    settledRef.current = true
    resultRef.current = result
    setOpenState(false)
  }

  const finalizeClose = () => {
    if (finalizedRef.current) return
    finalizedRef.current = true

    modal.resolve(resultRef.current)
    void modal.hide()
    modal.remove()
  }

  const handleInsertUrl = () => {
    const normalizedUrl = url.trim()
    if (!isSupportedImageUrl(normalizedUrl)) {
      setUrlError(true)
      inputRef.current?.focus()
      return
    }

    startClose({ type: 'url', url: normalizedUrl })
  }

  const handleSelectLocalImage = async () => {
    setLocalError(false)
    setIsSelecting(true)
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [
          {
            name: t('image_insert.local_filter'),
            extensions: ['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'],
          },
        ],
        fileAccessMode: 'scoped',
      })

      if (typeof selectedPath !== 'string') return

      await invoke<boolean>('save_security_bookmark', { path: selectedPath })
      startClose({ type: 'local', path: selectedPath })
    } catch (error) {
      logger.error('Failed to select a local image:', error)
      setLocalError(true)
    } finally {
      setIsSelecting(false)
    }
  }

  return (
    <Dialog.Root
      open={openState}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) startClose(null)
      }}
    >
      <Dialog.Content
        closeLabel={t('common.close')}
        onCloseAutoFocus={finalizeClose}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <Dialog.Header>
          <Dialog.Title>{t('image_insert.title')}</Dialog.Title>
          <Dialog.Description>{t('image_insert.description')}</Dialog.Description>
        </Dialog.Header>

        <Dialog.Body className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <label className='font-medium text-foreground' htmlFor={inputId}>
              {t('image_insert.url_label')}
            </label>
            <div className='flex gap-2'>
              <Input
                aria-invalid={urlError}
                id={inputId}
                onChange={(event) => {
                  setUrl(event.target.value)
                  if (urlError) setUrlError(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    handleInsertUrl()
                  }
                }}
                placeholder={t('image_insert.url_placeholder')}
                ref={inputRef}
                type='url'
                value={url}
              />
              <Button disabled={!url.trim()} onClick={handleInsertUrl}>
                <LinkIcon className='size-4' aria-hidden='true' />
                {t('image_insert.insert_url')}
              </Button>
            </div>
            {urlError ? (
              <p className='text-xs text-destructive' role='alert'>
                {t('image_insert.invalid_url')}
              </p>
            ) : null}
          </div>

          <div className='flex items-center gap-3' aria-hidden='true'>
            <span className='h-px flex-1 bg-border' />
            <span className='text-xs text-muted-foreground'>{t('common.or')}</span>
            <span className='h-px flex-1 bg-border' />
          </div>

          <Button
            className='w-full'
            disabled={isSelecting}
            onClick={() => void handleSelectLocalImage()}
            variant='outline'
          >
            <FolderOpenIcon className='size-4' aria-hidden='true' />
            {isSelecting
              ? t('image_insert.selecting_local')
              : t('image_insert.select_local')}
          </Button>
          <p className='text-xs text-muted-foreground'>
            {t('image_insert.local_behavior_hint')}
          </p>
          {localError ? (
            <p className='text-xs text-destructive' role='alert'>
              {t('image_insert.local_error')}
            </p>
          ) : null}
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export const ImageInsert = NiceModal.create(ImageInsertModal)
