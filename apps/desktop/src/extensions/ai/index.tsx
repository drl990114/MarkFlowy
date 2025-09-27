import type { RightBarItem } from '@/components/SideBar'
import type { RightNavItem } from '@/components/SideBar/SideBarHeader'
import SideBarHeader from '@/components/SideBar/SideBarHeader'
import { RIGHTBARITEMKEYS } from '@/constants'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { useCommandStore } from '@/stores'
import useThemeStore from '@/stores/useThemeStore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactLoading from 'react-loading'
import { Button, Input, Menu, Space } from 'zens'
import { aiProviders } from './aiProvidersService'
import { parseChatList } from './parseChatList'
import { BottomBar, Container, ListContainer } from './styles'
import useAiChatStore, { getCurrentAISettingData } from './useAiChatStore'

const ChatList: React.FC<ChatListProps> = (props) => {
  const {
    aiProvider,
    aiProviderCurModel,
    aiProviderModels,
    chatList,
    addChat,
    delChat,
    setAiProvider,
    setAiProviderCurModel,
  } = useAiChatStore()
  const { curTheme } = useThemeStore()
  const aiSettingData = getCurrentAISettingData()
  const apiBase = aiSettingData.apiBase
  const apiKey = aiSettingData.apiKey
  const [askInput, setAskInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [chatList.length])

  const handleSubmit = useCallback(() => {
    // if (!apiKey) {
    //   return toast.error('Please set your API Key first')
    // }

    addChat(askInput, apiBase, apiKey)
    setAskInput('')
  }, [apiKey, addChat, askInput])

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
            <Menu
              menuButtonProps={{ size: 'small' }}
              items={aiProviders.map((provider) => {
                return {
                  label: provider,
                  value: provider,
                  handler: () => {
                    setAiProvider(provider)
                  },
                }
              })}
            >
              {aiProvider} <i className='ri-arrow-drop-down-line'></i>
            </Menu>
            <Menu
              menuButtonProps={{ size: 'small' }}
              items={aiProviderModels.map((model) => {
                return {
                  label: model,
                  value: model,
                  handler: () => {
                    setAiProviderCurModel(model)
                  },
                }
              })}
            >
              {aiProviderCurModel[aiProvider]} <i className='ri-arrow-drop-down-line'></i>
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
                      <i className='ri-chat-smile-ai-line item-icon' />
                      <span>AI</span>
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
                        <div style={{ color: 'red', margin: '6px 0' }}>
                          Error: {chat.errorMessage || 'Request failed'}
                        </div>
                        <div>
                          Please check your ApiKey and settings{' '}
                          <a onClick={openSettingWindow}>setting</a>
                        </div>
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
          onPressEnter={handleSubmit}
          onChange={handleChange}
        />
        <Button className='submit' btnType='primary' size='small' onClick={handleSubmit}>
          {t('common.submit')}
        </Button>
      </BottomBar>
    </Container>
  )
}

interface ChatListProps {
  className?: string
}

const AI = {
  title: RIGHTBARITEMKEYS.AI,
  key: RIGHTBARITEMKEYS.AI,
  icon: <i className='ri-chat-smile-ai-line' />,
  components: <ChatList />,
} as RightBarItem

export default AI
