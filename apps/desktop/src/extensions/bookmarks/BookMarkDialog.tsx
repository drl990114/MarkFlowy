import { commandRegistry } from '@/commands'
import { TagCombobox } from '@/components/ui/tag-combobox'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import { Button, Dialog, Input } from 'zens'
import useBookMarksStore from './useBookMarksStore'

const hasOpenRadixLayer = () =>
  Boolean(
    document.querySelector(
      "[data-slot='select-content'][data-state='open'], [data-slot='popover-content'][data-state='open']",
    ),
  )

const ItemWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 0.9rem;

  label {
    text-align: right;
    min-width: 40px;
  }

  input {
    flex: 1;
  }

  .bookmark-tags {
    min-width: 0;
    flex: 1;
  }
`

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
    <Dialog
      title='bookmark'
      footer={[
        <Button key='ok' onClick={handleClose}>
          {t('common.cancel')}
        </Button>,
        <Button key='copy' btnType='primary' onClick={handleConfirm}>
          {t('common.confirm')}
        </Button>,
      ]}
      open={open}
      onClose={handleClose}
      hideOnEscape={() => !hasOpenRadixLayer()}
    >
      <ItemWrapper>
        <span>path</span>
        <span>{path}</span>
      </ItemWrapper>
      <ItemWrapper>
        <label htmlFor='bookmark-name'>name</label>
        <Input id='bookmark-name' value={name} onChange={handleNameChange} />
      </ItemWrapper>
      <ItemWrapper>
        <span id='bookmark-tags-label'>tags</span>
        <div className='bookmark-tags'>
          <TagCombobox
            aria-labelledby='bookmark-tags-label'
            placeholder='Tag'
            values={tags}
            onValuesChange={handleTagChange}
            options={tagOptions}
            allowCreate
          />
        </div>
      </ItemWrapper>
    </Dialog>
  )
}
