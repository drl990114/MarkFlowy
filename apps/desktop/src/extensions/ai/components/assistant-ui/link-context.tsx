import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'

export type OpenAssistantLink = (href: string) => void | Promise<void>

const AssistantLinkContext = createContext<OpenAssistantLink | undefined>(undefined)

export type AssistantLinkProviderProps = PropsWithChildren<{
  openLink: OpenAssistantLink
}>

/** Injects MarkFlowy's Tauri-safe link opener into Markdown and source parts. */
export function AssistantLinkProvider({ children, openLink }: AssistantLinkProviderProps) {
  const value = useMemo(() => openLink, [openLink])
  return <AssistantLinkContext.Provider value={value}>{children}</AssistantLinkContext.Provider>
}

export function useAssistantLink(): OpenAssistantLink | undefined {
  return useContext(AssistantLinkContext)
}
