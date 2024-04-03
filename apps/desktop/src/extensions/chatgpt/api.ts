export async function callChatGptApi(
  text: string,
  model: string,
  onStatus: (status: Status) => void,
  maxRetry = 5,
  apiKey: string,
  params?: {
    messages?: { role: string; content: string }[]
  },
): Promise<Status> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: params?.messages ?? [
        {
          role: 'system',
          content: 'Support search function, to answer my question.',
        },
        { role: 'user', content: text },
      ],
      stream: false,
    }),
  })

  if (response.status >= 400) {
    const res = (await response.json()) as ErrorResponse
    if (res.error.message.match(/You can retry/) && maxRetry > 0) {
      // Sometimes the API returns an error saying 'You can retry'. So we retry.
      onStatus({ status: 'pending', lastToken: `(Retrying ${maxRetry})` })
      return await callChatGptApi(text, model, onStatus, maxRetry - 1, apiKey)
    }
    onStatus({ status: 'error', message: res.error.message })
    return { status: 'error', message: res.error.message }
  } else {
    const res = (await response.json()) as ApiStreamResponse

    let resText = ''
    res.choices.forEach((choice) => (resText += choice.message.content))

    onStatus({ status: 'done', result: resText })
    return { status: 'done', result: resText }
  }
}

interface ErrorResponse {
  error: {
    message: string
    type: string
    code: string
    param: string
  }
}

export type Status =
  | { status: 'pending'; lastToken: string }
  | { status: 'done'; result: string }
  | { status: 'error'; message: string }

interface ApiStreamResponse {
  id: string
  model: string
  choices: {
    index: number
    message: { content: string; role: string }
    finish_reason: string
  }[]
}
