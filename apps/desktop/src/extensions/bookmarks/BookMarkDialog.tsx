import { useCommandStore } from '@/stores'
import { Select } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { Button, Dialog, Input } from 'zens'
import useBookMarksStore from './useBookMarksStore'

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

  .ant-select,
  input {
    flex: 1;
  }

  .ant-select-selector {
    padding: 4px 8px !important;
    min-height: 32px !important;
  }

  .ant-select-selection-placeholder {
    line-height: 32px !important;
  }
`

export const BookMarkDialog: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState<string>('')
  const { tagList, addBookMark } = useBookMarksStore()
  const { addCommand } = useCommandStore()
  const { t } = useTranslation()

  useEffect(() => {
    addCommand({
      id: 'open_bookmark_dialog',
      handler: (file) => {
        setPath(file.path)
        setName(file.name)
        setOpen(true)
      },
    })

    addCommand({
      id: 'edit_bookmark_dialog',
      handler: (bookmark) => {
        setPath(bookmark.path)
        setName(bookmark.title)
        setTags(bookmark.tags)
        setOpen(true)
      },
    })
  }, [addCommand])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }

  const handleNewTagInput = (value: string) => {
    setNewTag(value)
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

  const renderTagList = useMemo(() => {
    return newTag && !tagList.includes(newTag) ? [newTag, ...tagList] : tagList
  }, [newTag, tagList])

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
    >
      <ItemWrapper>
        <span>path</span>
        <span>{path}</span>
      </ItemWrapper>
      <ItemWrapper>
        <span>name</span>
        <Input value={name} onChange={handleNameChange} />
      </ItemWrapper>
      <ItemWrapper>
        <span>tags</span>
        <Select
          mode="tags"
          style={{ width: '100%' }}
          placeholder="Tag"
          value={tags}
          onChange={handleTagChange}
          options={renderTagList.map(tag => ({ value: tag, label: tag }))}
          onSearch={handleNewTagInput}
        />
      </ItemWrapper>
    </Dialog>
  )
}
