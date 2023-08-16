import { nanoid } from 'nanoid'
import { create } from 'zustand'
import { callChatGptApi } from '@/chatgpt/api'

const useChatGPTStore = create<ChatGPTStore>((set, get) => ({
  chatList: [],

  setChatStatus: (id, status) => {
    set((state) => {
      const curChat = state.chatList.find(history => history.id === id)
      if (curChat) {
        curChat.status = status
        return { ...state }
      }
      return state
    })
  },

  addChat: (question: string, apiKey: string) => {
    const curStore = get()
    const chat = curStore.addChatQuestion(question)
    callChatGptApi(
      question,
      'gpt-3.5-turbo',
      (res) => {
        if (res.status === 'done')
          curStore.addChatAnswer(chat.id, res.result)

        else
          curStore.setChatStatus(chat.id, res.status)
      },
      5,
      apiKey,
    )
    return chat
  },

  addChatQuestion: (question: string) => {
    const chat = {
      id: nanoid(),
      question,
      status: 'pending' as const,
    }
    set((state) => {
      return { ...state, chatList: [...state.chatList, chat] }
    })
    return chat
  },

  addChatAnswer: (id: string, answer: string) => {
    set((state) => {
      const curChat = state.chatList.find(history => history.id === id)
      if (curChat) {
        curChat.answer = answer
        curChat.status = 'done'
        return { ...state }
      }
      return state
    })
  },

  delChat: (id: string) => {
    set((state) => {
      return {
        ...state,
        chatList: state.chatList.filter(history => history.id !== id),
      }
    })
  },
}))

type ChatStatus = 'pending' | 'done' | 'error'

export interface ChatGPTHistory {
  id: string
  question: string
  answer?: string
  status: ChatStatus
}

interface ChatGPTStore {
  chatList: ChatGPTHistory[]
  setChatStatus: (id: string, status: ChatStatus) => void
  addChat: (question: string, apiKey: string) => ChatGPTHistory
  addChatQuestion: (question: string) => ChatGPTHistory
  addChatAnswer: (id: string, answer: string) => void
  delChat: (id: string) => void
}

export default useChatGPTStore
