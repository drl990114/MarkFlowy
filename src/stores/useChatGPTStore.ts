import { callChatGptApi } from '@/chatgpt/api'
import { nanoid } from 'nanoid'
import { create } from 'zustand'

const useChatGPTStore = create<ChatGPTStore>((set, get) => ({
  historyList: [],

  setChatStatus: (id, status) => {
    set((state) => {
      const curChat = state.historyList.find((history) => history.id === id)
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
        if (res.status === 'done') {
          curStore.addChatAnswer(chat.id, res.result)
        } else {
          curStore.setChatStatus(chat.id, res.status)
        }
      },
      5,
      apiKey
    )
    return chat
  },

  addChatQuestion: (question: string) => {
    const chat = { id: nanoid(), question: question, status: 'pending' as const }
    set((state) => {
      return { ...state, historyList: [...state.historyList, chat] }
    })
    return chat
  },

  addChatAnswer: (id: string, answer: string) => {
    set((state) => {
      const curChat = state.historyList.find((history) => history.id === id)
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
      return { ...state, historyList: state.historyList.filter((history) => history.id !== id) }
    })
  },
}))

type ChatStatus = 'pending' | 'done' | 'error'

interface ChatGPTHistory {
  id: string
  question: string
  answer?: string
  status: ChatStatus
}

interface ChatGPTStore {
  historyList: ChatGPTHistory[]
  setChatStatus: (id: string, status: ChatStatus) => void
  addChat: (question: string, apiKey: string) => ChatGPTHistory
  addChatQuestion: (question: string) => ChatGPTHistory
  addChatAnswer: (id: string, answer: string) => void
  delChat: (id: string) => void
}

export default useChatGPTStore
