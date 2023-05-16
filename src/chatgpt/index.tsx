import { Icon } from '@/components'
import { RightBarItem } from '@/components/SideBar'
import { RIGHTBARITEMKEYS } from '@/constants'
import { useGlobalSettingData } from '@/hooks'
import { useChatGPTStore } from '@/stores'
import { SettingKeys } from '@/utils/cacheManager/settingMap'
import Button from '@mui/material/Button'
import { useCallback, useState } from 'react'
import { BottomBar, Container, ListContainer } from './styles'

const ChatList: React.FC<ChatListProps> = (props) => {
  const { historyList, addChat } = useChatGPTStore()
  const [settingData] = useGlobalSettingData()
  const apiKey = settingData[SettingKeys.chatgpt]
  const [askInput, setAskInput] = useState('')

  const handleSubmit = useCallback(() => {
    if (!apiKey) {
      return
    }
    addChat(askInput, apiKey)
  }, [askInput, apiKey])

  return (
    <Container {...props}>
      <div className="content">
        <ListContainer>
          {historyList.map((history) => {
            return (
              <div key={history.id}>
                <div className="question item w-full h-full">
                  <div className="flex items-center">
                    <Icon name="user" iconProps={{ className: 'w-18px h-18px' }} />
                    <span>You</span>
                  </div>
                  <p>{history.question}</p>
                </div>
                <div className="answer item w-full h-full">
                  <div className="flex items-center">
                    <Icon name="chatgpt" iconProps={{ className: 'w-18px h-18px' }} />
                    <span>ChatGPT</span>
                  </div>
                  <p>{history.answer}</p>
                </div>
              </div>
            )
          })}
        </ListContainer>
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
  icon: 'chatgpt',
  components: <ChatList />,
} as RightBarItem

export default ChatGPT
