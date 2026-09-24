import type { AIProviderId } from '@/extensions/ai/aiProvidersService'
import type { CapricornSnippetKind } from '@/features/snippets/types'

export type OpenSettingTarget =
  | { category: 'ai'; providerId?: AIProviderId; snippetKind?: never }
  | { category: 'snippets'; snippetKind?: CapricornSnippetKind; providerId?: never }

export type SettingLeaveGuard = () => Promise<boolean>
export type RegisterSettingLeaveGuard = (guard: SettingLeaveGuard) => () => void
