import type { ChatGPTHistory } from '@/extensions/chatgpt/useChatGPTStore'

export function parseChatList(chatList: ChatGPTHistory[]): string {
  let markdownContent = ''

  chatList.forEach((chat) => {
    if (chat.status === 'done') {
      const questionText = questionToMarkdownText(chat.question)
      const answerText = answerToMarkdownText(chat.answer!)
      markdownContent += questionText + answerText
    }
  })

  return markdownContent
}

function questionToMarkdownText(question: string): string {
  return `Q: ${question} \n\n`
}

function answerToMarkdownText(answer: string): string {
  return `A: ${answer} \n\n`
}
