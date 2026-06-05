import NiceModal from '@ebay/nice-modal-react'
import { emit } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type React from 'react'
import type {
  DialogAction,
  DialogRememberOptions,
  ConfirmModalProps,
  InfoModalProps,
  InputConfirmModalProps,
} from '@/components/Modal'
import { MODAL_CONFIRM_ID, MODAL_INFO_ID, MODAL_INPUT_ID } from '@/components/Modal'
import useAppSettingStore from '@/stores/useAppSettingStore'

type DialogPreferences = Record<string, string>

export interface ConfirmOptions {
  title?: string
  content?: React.ReactNode
  actions?: DialogAction[]
  remember?: DialogRememberOptions
}

export interface InfoOptions {
  title?: string
  content?: React.ReactNode
  width?: string
}

export interface InputConfirmOptions {
  title?: string
  inputProps?: InputConfirmModalProps['inputProps']
}

const getDialogPreferences = () => {
  const preferences = useAppSettingStore.getState().settingData.dialog_preferences
  return preferences && typeof preferences === 'object' ? (preferences as DialogPreferences) : {}
}

const saveDialogPreference = async (key: string, actionId: string) => {
  const { settingData, setSettingData } = useAppSettingStore.getState()
  const nextSettingData = {
    ...settingData,
    dialog_preferences: {
      ...getDialogPreferences(),
      [key]: actionId,
    },
  }

  setSettingData(nextSettingData)
  await invoke('save_app_conf', { data: nextSettingData, label: 'markflowy' })
  emit('app_conf_change')
}

export const clearDialogPreference = async (key: string) => {
  const { settingData, setSettingData } = useAppSettingStore.getState()
  const { [key]: _removed, ...nextPreferences } = getDialogPreferences()
  const nextSettingData = {
    ...settingData,
    dialog_preferences: nextPreferences,
  }

  setSettingData(nextSettingData)
  await invoke('save_app_conf', { data: nextSettingData, label: 'markflowy' })
  emit('app_conf_change')
}

const confirm = async (options: ConfirmOptions) => {
  const rememberedAction = options.remember?.enabled === false
    ? undefined
    : options.remember?.key
      ? getDialogPreferences()[options.remember.key]
      : undefined

  if (rememberedAction) {
    return rememberedAction
  }

  return new Promise<string | null>((resolve) => {
    const props: ConfirmModalProps = {
      ...options,
      onRemember: async (actionId) => {
        if (options.remember?.key) {
          await saveDialogPreference(options.remember.key, actionId)
        }
      },
      onResolve: resolve,
    }

    NiceModal.show(MODAL_CONFIRM_ID, props)
  })
}

const info = async (options: InfoOptions) => {
  return new Promise<void>((resolve) => {
    const props: InfoModalProps = {
      ...options,
      onResolve: resolve,
    }

    NiceModal.show(MODAL_INFO_ID, props)
  })
}

const inputConfirm = async (options: InputConfirmOptions) => {
  return new Promise<string | null>((resolve) => {
    const props: InputConfirmModalProps = {
      ...options,
      onResolve: resolve,
    }

    NiceModal.show(MODAL_INPUT_ID, props)
  })
}

export const dialog = {
  confirm,
  info,
  inputConfirm,
}

export default dialog
