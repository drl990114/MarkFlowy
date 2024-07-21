type Message = {
  key: string
  payload: any
}

export const sendMessage = (message: Message) => {
  if (window.top === window) {
    return
  }

  window.top?.postMessage(message, '*')
}

export default {
  sendMessage
}
