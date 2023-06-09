import { EVENT, RIGHTBARITEMKEYS } from '@/constants'
import { SettingKeys } from '@/helper/cacheManager/settingMap'
import { createFile } from '@/helper/filesys'
import { RightBarItem } from '@/renderer/components/SideBar'
import { useGlobalSettingData, useGlobalTheme } from '@/renderer/hooks'
import { useEditorStore } from '@/renderer/stores'
import Button from '@mui/material/Button'
import { emit } from '@tauri-apps/api/event'
import { useCallback, useState } from 'react'
import ReactLoading from 'react-loading'
import { parseChatList } from './parseChatList'
import { BottomBar, Container, ListContainer } from './styles'
import useChatGPTStore from './useChatGPTStore'

const ChatList: React.FC<ChatListProps> = (props) => {
  const { chatList, addChat, delChat } = useChatGPTStore()
  const [settingData] = useGlobalSettingData()
  const { themeColors } = useGlobalTheme()
  const apiKey = settingData[SettingKeys.chatgpt]
  const [askInput, setAskInput] = useState('')
  const { addOpenedFile, setActiveId } = useEditorStore()

  const handleSubmit = useCallback(() => {
    if (!apiKey) {
      return
    }
    addChat(askInput, apiKey)
  }, [askInput, apiKey])

  const exportChats = useCallback(() => {
    const content = parseChatList(chatList)
    const gptNotesFile = createFile({ name: 'notes.md', content })
    addOpenedFile(gptNotesFile.id)
    setActiveId(gptNotesFile.id)
    return
  }, [chatList, addOpenedFile, setActiveId])

  const openSettingWindow = useCallback(() => emit(EVENT.open_window_setting), [])

  return (
    <Container {...props}>
      <div className="header">
        ChatGPT
        <div>
          <i className="icon ri-file-download-line" onClick={exportChats}></i>
        </div>
      </div>
      <div className="content">
        {chatList.length > 0 ? (
          <ListContainer>
            {chatList.map((chat) => {
              return (
                <div key={chat.id}>
                  <div className="question item">
                    <div className="item-header">
                      <div className="item-title">
                        <i className="ri-user-4-line item-icon" />
                        <span>You</span>
                      </div>
                      <div>
                        <i className="icon ri-delete-bin-line" onClick={() => delChat(chat.id)} />
                      </div>
                    </div>
                    <p>{chat.question}</p>
                  </div>
                  <div className="answer item">
                    <div className="item-title">
                      <i className="ri-openai-fill item-icon" />
                      <span>ChatGPT</span>
                    </div>
                    {chat.status === 'pending' ? (
                      <ReactLoading type="bubbles" width={35} height={35} color={themeColors.accentColor} />
                    ) : chat.status === 'error' ? (
                      <div>
                        request error, please check your ApiKey is it right or not <a onClick={openSettingWindow}>setting</a>
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
          <div className="introduction">
            <div className="introduction-title">
              <i className="ri-flashlight-line"></i>Capabilities
            </div>
            <div className="introduction-item">One-click export of conversation content as md file</div>
          </div>
        )}
      </div>
      <BottomBar>
        <input
          className="input"
          value={askInput}
          placeholder="input question"
          onChange={(event) => {
            setAskInput(event.target.value)
          }}
        />
        <Button className="submit" size="small" variant="contained" onClick={handleSubmit}>
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
  icon: <i className="ri-openai-fill" />,
  components: <ChatList />,
} as RightBarItem

export default ChatGPT
