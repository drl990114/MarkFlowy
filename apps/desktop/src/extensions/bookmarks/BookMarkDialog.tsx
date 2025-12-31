import { useCommandStore } from '@/stores'
import { Autocomplete, TextField } from '@mui/material'
import type { SyntheticEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
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

  .MuiTextField-root,
  .MuiAutocomplete-root,
  input {
    flex: 1;
  }

  .MuiInputBase-input {
    padding: 7.5px 4px 7.5px 5px;
  }
  .MuiInputBase-root.MuiOutlinedInput-root {
    padding: 0 0.5rem;
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

  const handleNewTagInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTag(e.target.value)
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

  const handleTagChange = (_event: SyntheticEvent<Element, Event>, newValue: string[]) => {
    setTags(newValue as string[])
  }

  const renderTagList = useMemo(() => {
    return newTag && !tagList.includes(newTag) ? [newTag, ...tagList] : tagList
  }, [newTag, tagList])

  return (
    <Dialog
      title='bookmark'
      footer={[
        <Button key='ok' onClick={handleClose}>
          Cancel
        </Button>,
        <Button key='copy' btnType='primary' onClick={handleConfirm}>
          Confirm
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
        <Autocomplete
          multiple
          options={renderTagList}
          value={tags}
          onChange={handleTagChange}
          renderInput={(params) => (
            <TextField {...params} placeholder='Tag' onInput={handleNewTagInput} />
          )}
        />
      </ItemWrapper>
    </Dialog>
  )
}
