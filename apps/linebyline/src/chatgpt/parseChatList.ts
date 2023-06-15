import { ChatGPTHistory } from "@/chatgpt/useChatGPTStore";

export const parseChatList = (chatList: ChatGPTHistory[]): string => {
  let markdownContent = ''
  
  chatList.forEach(chat => {
    if (chat.status === 'done') {
      const questionText = questionToMarkdownText(chat.question)
      const answerText = answerToMarkdownText(chat.answer!)
      markdownContent += questionText + answerText
    }
  });

  return markdownContent
}

const questionToMarkdownText = (question: string): string => {
  return `Q: ${question} \n\n`
}

const answerToMarkdownText = (answer: string): string => {
  
  return `A: ${answer} \n\n`
}
