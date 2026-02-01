import type { RightBarItem } from '@/components/SideBar'
import type { RightNavItem } from '@/components/SideBar/SideBarHeader'
import SideBarHeader from '@/components/SideBar/SideBarHeader'
import { EVENT, RIGHTBARITEMKEYS } from '@/constants'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { useCommandStore } from '@/stores'
import type { BubbleItemType } from '@ant-design/x'
import { Actions, Bubble, Sender } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { RoleType } from '@ant-design/x/es/bubble/interface'
import { ErrorBoundary } from '@sentry/react'
import { Spin, Typography } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Menu, Space, toast } from 'zens'
import { aiProviders } from './aiProvidersService'
import { parseChatList } from './parseChatList'
import { BottomBar, Container } from './styles'
import useAiChatStore, { AIChatMessage, getCurrentAISettingData } from './useAiChatStore'
const { Text } = Typography

const ChatList: React.FC<ChatListProps> = (props) => {
  const {
    aiProvider,
    aiProviderCurModel,
    aiProviderModels,
    chatList,
    addChat,
    delChat,
    cancelChatStream,
    setAiProvider,
    setAiProviderCurModel,
  } = useAiChatStore()
  const aiSettingData = getCurrentAISettingData()
  const [askInput, setAskInput] = useState('')
  const { t } = useTranslation()

  const bubbleItems: BubbleItemType[] = useMemo(() => {
    return chatList.map((message) => {
      if (message.role === 'user') {
        return {
          key: message.key,
          role: 'user',
          content: {
            ...message,
          },
          typing: false,
        }
      }

      return {
        key: message.key,
        role: 'ai',
        content: {
          ...message,
        },
        typing: message.status === 'streaming',
        loading: message.status === 'pending',
      }
    })
  }, [chatList])

  const actionItems = [
    {
      key: 'copy',
      icon: <Icon.CopyOutlined />,
      label: t('common.copy'),
    },
    {
      key: 'del',
      icon: <Icon.DeleteOutlined />,
      label: t('common.delete'),
    },
  ]

  const roleConfig: RoleType = useMemo(
    () => ({
      ai: {
        header: 'AI Assistant',
        styles: {
          content: {
            padding: '6px 12px',
            fontSize: '1em',
            minHeight: 'auto',
          },
        },
        loadingRender: () => <Spin indicator={<Icon.LoadingOutlined spin />} />,
        contentRender(content) {
          console.log('content', content)
          return (
            <ErrorBoundary>
              <XMarkdown>{content.content}</XMarkdown>
            </ErrorBoundary>
          )
        },
        footer: (item: AIChatMessage) => {
          return (
            <div>
              {item.status === 'error' ? (
                <Space direction='horizontal'>
                  <Text type='danger' style={{ fontSize: '12px' }}>
                    Error: {item.errorMessage || 'Request failed'}{' '}
                    <a onClick={openSettingWindow}>setting</a>
                  </Text>
                </Space>
              ) : null}
              <Actions
                items={actionItems}
                onClick={(actionItem) => {
                  const chatList = useAiChatStore.getState().chatList
                  const message = chatList.find((msg) => msg.key === item.key)
                  if (!message) return

                  if (actionItem.key === 'copy') {
                    navigator.clipboard.writeText(message.content)
                    toast.success(t('common.success'))
                  } else if (actionItem.key === 'del') {
                    delChat(message.key)

                    if (message.role === 'ai') {
                      const currentIndex = chatList.findIndex((msg) => msg.key === message.key)
                      if (currentIndex > 0) {
                        for (let i = currentIndex - 1; i >= 0; i--) {
                          if (chatList[i].role === 'user') {
                            delChat(chatList[i].key)
                            break
                          }
                        }
                      }
                    } else if (message.role === 'user') {
                      const currentIndex = chatList.findIndex((msg) => msg.key === message.key)
                      if (currentIndex < chatList.length - 1) {
                        for (let i = currentIndex + 1; i < chatList.length; i++) {
                          if (chatList[i].role === 'ai') {
                            delChat(chatList[i].key)
                            break
                          }
                        }
                      }
                    }
                  }
                }}
              ></Actions>
            </div>
          )
        },
      },
      user: {
        placement: 'end' as const,
        header: 'You',
        styles: {
          content: {
            padding: '6px 12px',
            fontSize: '1em',
            minHeight: 'auto',
          },
        },
        contentRender(content) {
          return <Text>{content.content}</Text>
        },
      },
    }),
    [],
  )

  const handleSubmit = useCallback(() => {
    if (askInput.trim()) {
      addChat(askInput, aiSettingData)
      setAskInput('')
    }
  }, [aiSettingData, addChat, askInput])

  const exportChats = useCallback(() => {
    const oldFormatChats = chatList
      .map((message) => {
        if (message.role === 'user') {
          return {
            id: message.key,
            question: message.content,
            status: 'done' as const,
          }
        } else if (message.role === 'ai') {
          return {
            id: message.key,
            answer: message.content,
            status: message.status === 'done' ? 'done' : 'pending',
          }
        }
        return null
      })
      .filter(Boolean) as any[]

    const content = parseChatList(oldFormatChats)
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

  const handleChange = useCallback((value: string) => {
    setAskInput(value)
  }, [])

  const openSettingWindow = useCallback(
    () => useCommandStore.getState().execute(EVENT.app_openSetting),
    [],
  )

  return (
    <Container {...props}>
      <SideBarHeader
        name={
          <Space>
            <Menu
              style={{ zIndex: 1000 }}
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
              style={{ zIndex: 1000 }}
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
            tooltip: { title: 'Export Chats' },
          },
        ]}
      />
      <div className='content'>
        {chatList.length > 0 ? (
          <Bubble.List role={roleConfig} items={bubbleItems} style={{ flex: 1 }} />
        ) : (
          <div className='introduction'>
            <div className='introduction-title'>
              <i className='ri-flashlight-line' />
              {t('ai.capabilities')}
            </div>
            <div className='introduction-item'>{t('ai.export_conversation')}</div>
          </div>
        )}
      </div>
      <BottomBar>
        <Sender
          value={askInput}
          submitType='shiftEnter'
          placeholder='shift + enter ->'
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => {
            const streamingMessage = chatList.find((msg) => msg.status === 'streaming')
            if (streamingMessage) {
              cancelChatStream(streamingMessage.key)
            }
          }}
          autoSize={{ minRows: 2, maxRows: 6 }}
          loading={chatList.some((msg) => msg.status === 'pending' || msg.status === 'streaming')}
        />
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
