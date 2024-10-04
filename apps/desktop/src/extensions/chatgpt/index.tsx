import { Button, Input, Menu, Space } from 'zens'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactLoading from 'react-loading'
import { parseChatList } from './parseChatList'
import { BottomBar, Container, ListContainer } from './styles'
import useChatGPTStore from './useChatGPTStore'
import { useCommandStore } from '@/stores'
import { SettingKeys } from '@/router/Setting/settingMap'
import { RIGHTBARITEMKEYS } from '@/constants'
import type { RightBarItem } from '@/components/SideBar'
import type { RightNavItem } from '@/components/SideBar/SideBarHeader'
import SideBarHeader from '@/components/SideBar/SideBarHeader'
import useThemeStore from '@/stores/useThemeStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { addNewMarkdownFileEdit } from '@/services/editor-file'

const ChatList: React.FC<ChatListProps> = (props) => {
  const { chatList, curGptModelIndex, gptModels, setCurGptModelIndex, addChat, delChat } =
    useChatGPTStore()
  const { settingData } = useAppSettingStore()
  const { curTheme } = useThemeStore()
  const apiBase = settingData[SettingKeys.cahtgpt_url]
  const apiKey = settingData[SettingKeys.chatgpt]
  const [askInput, setAskInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [chatList.length])

  const handleSubmit = useCallback(() => {
    if (!apiKey) return

    addChat(askInput, apiBase, apiKey)
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
    addNewMarkdownFileEdit({ fileName: 'notes.md', content })
  }, [chatList])

  const handleRightNavItemClick = useCallback(
    (item: RightNavItem) => {
      if (item.key === 'exportChats') {
        exportChats()
      }
    },
    [exportChats],
  )

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setAskInput(event.target.value)
  }, [])

  const openSettingWindow = useCallback(
    () => useCommandStore.getState().execute('open_setting_dialog'),
    [],
  )

  return (
    <Container {...props}>
      <SideBarHeader
        name={
          <Space>
            ChatGPT
            <Menu
              menuButtonProps={{ size: 'small' }}
              items={gptModels.map((model, index) => {
                return {
                  label: model,
                  value: model,
                  handler: () => {
                    setCurGptModelIndex(index)
                  },
                }
              })}
            >
              {gptModels[curGptModelIndex]} <i className='ri-arrow-drop-down-line'></i>
            </Menu>
          </Space>
        }
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
                        color={curTheme.styledConstants.accentColor}
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
          onPressEnter={handleSubmit}
          onChange={handleChange}
        />
        <Button className='submit' btnType='primary' size='small' onClick={handleSubmit}>
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
