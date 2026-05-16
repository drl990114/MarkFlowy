export interface AIOptions {
  defaultSelectProvider?: string

  supportProviderInfosMap: Record<
    string,
    {
      models: string[]
    }
  >

  generateText: (options: {
    provider: string
    model: string
    prompt: string
    temperature?: number
  }) => Promise<string | null>

  copilot?: CopilotOptions
}

export type CopilotContext = {
  nodeType: string
  textBefore: string
  textAfter: string
  prevParagraph: string | null
  nextParagraph: string | null
}

export type CopilotOptions = {
  generateText?: (options: { context: CopilotContext }) => Promise<string | null>
  debounceMs?: number
  maxContextChars?: number
  maxSuggestionChars?: number
}
