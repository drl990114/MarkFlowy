import { create } from 'zustand'
import { parseAIModelKey } from './aiProvidersService'
import type { AIModelKey } from './aiProvidersService'

export const AI_MODEL_PREFERENCE_STORAGE_KEY = 'markflowy-ai-profile-v1'

type StoredAIModelPreference = {
  selectedModelKey?: AIModelKey
}

function getStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function readStoredPreference(): AIModelKey | undefined {
  const storage = getStorage()
  if (!storage) return undefined

  try {
    const parsed = JSON.parse(
      storage.getItem(AI_MODEL_PREFERENCE_STORAGE_KEY) ?? '{}',
    ) as StoredAIModelPreference | null
    return parseAIModelKey(parsed?.selectedModelKey) ? parsed?.selectedModelKey : undefined
  } catch {
    return undefined
  }
}

function writeStoredPreference(selectedModelKey?: AIModelKey) {
  const storage = getStorage()
  if (!storage) return

  try {
    if (selectedModelKey) {
      storage.setItem(
        AI_MODEL_PREFERENCE_STORAGE_KEY,
        JSON.stringify({ selectedModelKey } satisfies StoredAIModelPreference),
      )
    } else {
      storage.removeItem(AI_MODEL_PREFERENCE_STORAGE_KEY)
    }
  } catch {
    // The preference is best-effort (for example private-mode storage can
    // throw); the in-memory selection remains usable for this session.
  }
}

type AIModelPreferenceStore = {
  selectedModelKey?: AIModelKey
  setSelectedModelKey: (modelKey?: AIModelKey) => void
}

export const useAIModelPreference = create<AIModelPreferenceStore>((set) => ({
  selectedModelKey: readStoredPreference(),
  setSelectedModelKey: (selectedModelKey) => {
    if (selectedModelKey && !parseAIModelKey(selectedModelKey)) {
      throw new Error(`Invalid AI model key: ${selectedModelKey}`)
    }
    writeStoredPreference(selectedModelKey)
    set({ selectedModelKey })
  },
}))

export function getPreferredAIModelKey(): AIModelKey | undefined {
  return useAIModelPreference.getState().selectedModelKey
}

export function setPreferredAIModelKey(modelKey: AIModelKey): void {
  useAIModelPreference.getState().setSelectedModelKey(modelKey)
}

export function clearPreferredAIModelKey(): void {
  useAIModelPreference.getState().setSelectedModelKey(undefined)
}
