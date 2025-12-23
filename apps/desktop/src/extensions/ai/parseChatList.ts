interface AIChatHistory {
  id: string
  question?: string
  answer?: string
  status: 'pending' | 'streaming' | 'done' | 'error'
}

export function parseChatList(chatList: AIChatHistory[]): string {
  let markdownContent = ''

  chatList.forEach((chat) => {
    if (chat.status === 'done') {
      if (chat.question) {
        const questionText = questionToMarkdownText(chat.question!)
        markdownContent += questionText
      }
      if (chat.answer) {
        const answerText = answerToMarkdownText(chat.answer!)
        markdownContent += answerText
      }
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
