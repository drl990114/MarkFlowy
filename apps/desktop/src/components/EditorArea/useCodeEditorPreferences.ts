import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { resolveCodeEditorPreferences, selectCodeEditorPreferences } from './codeEditorSettings'

export function useCodeEditorPreferences() {
  const preferences = useAppSettingStore(
    useShallow((state) => selectCodeEditorPreferences(state.settingData)),
  )
  return useMemo(() => resolveCodeEditorPreferences(preferences), [preferences])
}
