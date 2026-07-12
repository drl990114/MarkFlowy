import { commandRegistry } from '@/commands'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { TagCombobox } from '@/components/ui/tag-combobox'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/i18n'
import useBookMarksStore from './useBookMarksStore'

export const BookMarkDialog: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const { tagList, addBookMark } = useBookMarksStore()
  const { t } = useTranslation()

  useEffect(() => {
    const d1 = commandRegistry.registerCommand({
      id: 'open_bookmark_dialog',
      handler: (file) => {
        setPath(file.path)
        setName(file.name)
        setOpen(true)
      },
    })

    const d2 = commandRegistry.registerCommand({
      id: 'edit_bookmark_dialog',
      handler: (bookmark) => {
        setPath(bookmark.path)
        setName(bookmark.title)
        setTags(bookmark.tags)
        setOpen(true)
      },
    })

    return () => {
      d1.dispose()
      d2.dispose()
    }
  }, [])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }

  const handleConfirm = () => {
    addBookMark({
      title: name,
      path,
      tags,
    })
    setOpen(false)
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleTagChange = (newValue: string[]) => {
    setTags(newValue)
  }

  const tagOptions = useMemo(
    () => tagList.map((tag) => ({ value: tag, label: tag })),
    [tagList],
  )

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <Dialog.Content aria-describedby={undefined} closeLabel={t('common.close')}>
        <Dialog.Header>
          <Dialog.Title>{t('action.bookmark')}</Dialog.Title>
        </Dialog.Header>

        <Dialog.Body>
          <div className='grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-4'>
            <span className='text-right text-xs font-medium text-foreground-secondary'>Path</span>
            <span
              className='min-w-0 break-all rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground'
              title={path}
            >
              {path}
            </span>

            <label
              className='text-right text-xs font-medium text-foreground-secondary'
              htmlFor='bookmark-name'
            >
              Name
            </label>
            <Input id='bookmark-name' value={name} onChange={handleNameChange} />

            <span
              className='text-right text-xs font-medium text-foreground-secondary'
              id='bookmark-tags-label'
            >
              Tags
            </span>
            <div className='min-w-0'>
              <TagCombobox
                allowCreate
                aria-labelledby='bookmark-tags-label'
                onValuesChange={handleTagChange}
                options={tagOptions}
                placeholder='Tag'
                values={tags}
              />
            </div>
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <Button onClick={handleClose} variant='outline'>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm}>{t('common.confirm')}</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}
