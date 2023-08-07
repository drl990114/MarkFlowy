import { Input } from '@mui/material'
import Button from '@mui/material/Button'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactLoading from 'react-loading'
import { parseChatList } from './parseChatList'
import { BottomBar, Container, ListContainer } from './styles'
import useChatGPTStore from './useChatGPTStore'
import { useEditorStore } from '@/stores'
import { useGlobalSettingData, useGlobalTheme } from '@/hooks'
import { createFile } from '@/helper/filesys'
import { SettingKeys } from '@/helper/cacheManager/settingMap'
import { RIGHTBARITEMKEYS } from '@/constants'
import type { RightBarItem } from '@/components/SideBar'
import { invoke } from '@tauri-apps/api'
import type { RightNavItem } from '@/components/SideBar/SideBarHeader'
import SideBarHeader from '@/components/SideBar/SideBarHeader'

const ChatList: React.FC<ChatListProps> = (props) => {
  const { chatList, addChat, delChat } = useChatGPTStore()
  const [settingData] = useGlobalSettingData()
  const { themeColors } = useGlobalTheme()
  const apiKey = settingData[SettingKeys.chatgpt]
  const [askInput, setAskInput] = useState('')
  const { addOpenedFile, setActiveId } = useEditorStore()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [chatList.length])

  const handleSubmit = useCallback(() => {
    if (!apiKey) return

    addChat(askInput, apiKey)
    setAskInput('')
  }, [apiKey, addChat, askInput])

  const handleKeydown: React.KeyboardEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (!event.shiftKey && event.keyCode === 13) {
        handleSubmit()
        event.preventDefault()
        return false
      }
    },
    [handleSubmit],
  )

  const exportChats = useCallback(() => {
    const content = parseChatList(chatList)
    const gptNotesFile = createFile({ name: 'notes.md', content })
    addOpenedFile(gptNotesFile.id)
    setActiveId(gptNotesFile.id)
  }, [chatList, addOpenedFile, setActiveId])

  const handleRightNavItemClick = useCallback(
    (item: RightNavItem) => {
      if (item.key === 'exportChats') {
        exportChats()
      }
    },
    [exportChats],
  )
  const openSettingWindow = useCallback(() => invoke('open_conf_window'), [])

  return (
    <Container {...props}>
      <SideBarHeader
        name='CHATGPT'
        onRightNavItemClick={handleRightNavItemClick}
        rightNavItems={[
          {
            iconCls: 'ri-file-download-line',
            key: 'exportChats',
            tooltip: { title: 'Export Chats', arrow: true },
          },
        ]}
      />
      <div className='content' ref={listRef}>
        {chatList.length > 0 ? (
          <ListContainer>
            {chatList.map((chat) => {
              return (
                <div key={chat.id}>
                  <div className='question item'>
                    <div className='item-header'>
                      <div className='item-title'>
                        <i className='ri-user-4-line item-icon' />
                        <span>You</span>
                      </div>
                      <div>
                        <i className='icon ri-delete-bin-line' onClick={() => delChat(chat.id)} />
                      </div>
                    </div>
                    <p>{chat.question}</p>
                  </div>
                  <div className='answer item'>
                    <div className='item-title'>
                      <i className='ri-openai-fill item-icon' />
                      <span>ChatGPT</span>
                    </div>
                    {chat.status === 'pending' ? (
                      <ReactLoading
                        type='bubbles'
                        width={35}
                        height={35}
                        color={themeColors.accentColor}
                      />
                    ) : chat.status === 'error' ? (
                      <div>
                        request error, please check your ApiKey is it right or not{' '}
                        <a onClick={openSettingWindow}>setting</a>
                      </div>
                    ) : (
                      <p>{chat.answer}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </ListContainer>
        ) : (
          <div className='introduction'>
            <div className='introduction-title'>
              <i className='ri-flashlight-line' />
              Capabilities
            </div>
            <div className='introduction-item'>
              One-click export of conversation content as md file
            </div>
          </div>
        )}
      </div>
      <BottomBar>
        <Input
          className='input'
          value={askInput}
          placeholder='input question'
          onKeyDown={handleKeydown}
          onChange={(event) => {
            setAskInput(event.target.value)
          }}
        />
        <Button className='submit' size='small' variant='contained' onClick={handleSubmit}>
          submit
        </Button>
      </BottomBar>
    </Container>
  )
}

interface ChatListProps {
  className?: string
}

const ChatGPT = {
  title: RIGHTBARITEMKEYS.ChatGPT,
  key: RIGHTBARITEMKEYS.ChatGPT,
  icon: <i className='ri-openai-fill' />,
  components: <ChatList />,
} as RightBarItem

export default ChatGPT
